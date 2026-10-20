import { describe, expect, it } from "vitest";
import { avisarRegistroSchema, descreverEventoPedido, meiosAvisoRegistro, quemAvisarSchema, registrarPedidoSchema } from "./pedidos.ts";
import { AVISO_NOVO_SINDICO, avisoNovoSchema } from "./prazos.ts";

const V = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const NOVO = { categoriaId: V, prioridadeId: V, assunto: "Vazamento", descricao: "Mancha no teto", canal: "TELEFONE", local: "Garagem" };

describe("aviso de pedido registrado (F6.4)", () => {
  it("AT-26: sem escolha, o registro segue as regras do condomínio", () => {
    expect(registrarPedidoSchema.parse(NOVO).avisar).toBeNull();
    expect(registrarPedidoSchema.parse({ ...NOVO, avisar: { quemPediu: false, sindico: true } }).avisar).toEqual({ quemPediu: false, sindico: true });
  });

  it("AT-26: o prestador vem do cadastro, com a mensagem de 3 a 1500 caracteres", () => {
    expect(avisarRegistroSchema.safeParse({ prestador: { id: V, texto: "Oi" } }).success).toBe(false);
    expect(avisarRegistroSchema.safeParse({ prestador: { id: "abc", texto: "Elevador parado." } }).success).toBe(false);
    expect(avisarRegistroSchema.safeParse({ prestador: { id: V, texto: "x".repeat(1501) } }).success).toBe(false);
    expect(avisarRegistroSchema.safeParse({ prestador: { id: V, texto: "Elevador parado." } }).success).toBe(true);
  });

  it("CD-02: os moradores afetados são todos, blocos ou unidades, com o que foi escolhido", () => {
    const m = { titulo: "Elevador parado", texto: "Use o de serviço." };
    expect(avisarRegistroSchema.safeParse({ moradores: { ...m, publico: "BLOCOS" } }).success).toBe(false);
    expect(avisarRegistroSchema.safeParse({ moradores: { ...m, publico: "UNIDADES" } }).success).toBe(false);
    expect(avisarRegistroSchema.safeParse({ moradores: { ...m, publico: "CONTATOS", blocos: [V] } }).success).toBe(false);
    expect(avisarRegistroSchema.parse({ moradores: { ...m, publico: "BLOCOS", blocos: [V] } }).moradores?.unidades).toEqual([]);
    expect(avisarRegistroSchema.safeParse({ moradores: { ...m, publico: "TODOS" } }).success).toBe(true);
  });

  it("AT-26: a prévia aceita o registro pela metade", () => {
    expect(quemAvisarSchema.safeParse({}).success).toBe(true);
    expect(quemAvisarSchema.safeParse({ unidadeId: V, privado: true, textoPrestador: "Ligue no (61) 99999-0001" }).success).toBe(true);
    expect(quemAvisarSchema.safeParse({ unidadeId: "101" }).success).toBe(false);
  });

  it("AT-26: a regra do síndico é nunca, sem responsável ou urgente, ou todos", () => {
    expect(Object.keys(AVISO_NOVO_SINDICO)).toEqual(["NUNCA", "SEM_RESPONSAVEL_OU_URGENTE", "TODOS"]);
    expect(avisoNovoSchema.safeParse({ versao: 3, sindico: "SEMPRE", protocolo: true }).success).toBe(false);
    expect(avisoNovoSchema.safeParse({ versao: 3, sindico: "TODOS" }).success).toBe(false);
    expect(avisoNovoSchema.safeParse({ versao: 3, sindico: "NUNCA", protocolo: false }).success).toBe(true);
  });

  it("AT-17: cada aviso do registro vira uma linha do histórico, com o nome lido na hora", () => {
    expect(meiosAvisoRegistro(["SINO", "WHATSAPP"])).toBe("sino e WhatsApp");
    expect(descreverEventoPedido("pedido.avisado", { destino: "QUEM_PEDIU", quem: "Marta Souza", meios: ["WHATSAPP"] }))
      .toBe("Protocolo mandado a Marta Souza pelo WhatsApp do condomínio");
    expect(descreverEventoPedido("pedido.avisado", { destino: "QUEM_PEDIU", quem: "Rui Lima", meios: ["EMAIL"] }))
      .toBe("Protocolo mandado a Rui Lima por e-mail");
    expect(descreverEventoPedido("pedido.avisado", { destino: "RESPONSAVEL", quem: "Gil", meios: ["SINO", "WHATSAPP"] }))
      .toBe("Aviso de pedido novo para Gil · sino e WhatsApp");
    expect(descreverEventoPedido("pedido.avisado", { destino: "SINDICO", quem: "Ana Lima", meios: ["SINO"], pelaRegra: true }))
      .toBe("Aviso de pedido novo para Ana Lima (síndico) · sino · pela regra do condomínio");
    expect(descreverEventoPedido("pedido.avisado", { destino: "PRESTADOR", quem: "Elevadores Planalto", meios: ["WHATSAPP"], editado: true }))
      .toBe("Aviso ao prestador Elevadores Planalto pelo WhatsApp do condomínio · texto editado");
    expect(descreverEventoPedido("pedido.avisado", { destino: "MORADORES", meios: ["COMUNICADO"] })).toBe("Comunicado publicado para os moradores afetados");
  });
});

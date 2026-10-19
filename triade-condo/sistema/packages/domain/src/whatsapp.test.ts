import { describe, expect, it } from "vitest";
import {
  configWhatsappSchema,
  credenciaisWhatsappSchema,
  meusAvisosWhatsappSchema,
  prometePrazo,
  responderWhatsappSchema,
  triarWhatsappSchema,
} from "./whatsapp.ts";

const ID = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";

describe("WhatsApp do condomínio (passo 5)", () => {
  it("W-01: credenciais com instância simples e token", () => {
    expect(credenciaisWhatsappSchema.safeParse({ instancia: "ipe-inst", token: "abcdefgh123" }).success).toBe(true);
    expect(credenciaisWhatsappSchema.safeParse({ instancia: "ipe inst", token: "abcdefgh123" }).success).toBe(false);
    expect(credenciaisWhatsappSchema.safeParse({ instancia: "ipe", token: "curto" }).success).toBe(false);
  });

  it("MU-02: arquivar pede motivo; juntar pede o pedido; ligar pede o contato", () => {
    expect(triarWhatsappSchema.safeParse({ acao: "ARQUIVAR", motivo: " " }).success).toBe(false);
    expect(triarWhatsappSchema.safeParse({ acao: "ARQUIVAR", motivo: "Engano" }).success).toBe(true);
    expect(triarWhatsappSchema.safeParse({ acao: "PEDIDO" }).success).toBe(false);
    expect(triarWhatsappSchema.safeParse({ acao: "CONTATO", contatoId: ID }).success).toBe(true);
  });

  it("AT-06: a resposta pelo WhatsApp tem texto e versão", () => {
    expect(responderWhatsappSchema.safeParse({ versao: 2, texto: "ok" }).success).toBe(false);
    expect(responderWhatsappSchema.safeParse({ versao: 2, texto: "O eletricista vem segunda." }).success).toBe(true);
  });

  it("W-12: a mensagem de fora do horário não promete prazo", () => {
    expect(prometePrazo("Respondemos em até 2 horas.")).toBe(true);
    expect(prometePrazo("Atendimento imediato pelo síndico.")).toBe(true);
    expect(prometePrazo("Recebemos sua mensagem fora do horário. O condomínio confere no próximo horário.")).toBe(false);
    expect(configWhatsappSchema.safeParse({ versao: 1, foraHorario: "Curta", categoriaId: ID, prioridadeId: ID, anexarMinutos: 30 }).success)
      .toBe(false);
    expect(configWhatsappSchema.safeParse({ versao: 1, foraHorario: "Recebemos fora do horário de atendimento.", categoriaId: ID,
                                            prioridadeId: ID, anexarMinutos: 45 }).success).toBe(false);
  });

  it("W-11: os avisos no WhatsApp pedem um celular válido e tipos conhecidos", () => {
    expect(meusAvisosWhatsappSchema.safeParse({ telefone: "6199", tipos: ["PEDIDO_NOVO"], ligado: true }).success).toBe(false);
    const ok = meusAvisosWhatsappSchema.parse({ telefone: "+5561991002233", tipos: ["PEDIDO_NOVO", "PEDIDO_NOVO"], ligado: true });
    expect(ok.tipos).toEqual(["PEDIDO_NOVO"]);
    expect(meusAvisosWhatsappSchema.safeParse({ telefone: "+5561991002233", tipos: ["TUDO"], ligado: true }).success).toBe(false);
  });
});

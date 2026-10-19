import { describe, expect, it } from "vitest";
import {
  configWhatsappSchema,
  decidirModeloSchema,
  LIMITE_FORA_DA_JANELA,
  modeloCorpoValido,
  PROXIMAS_SITUACOES_MODELO,
  renderizarModelo,
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

describe("Janela de 24h e modelos (F5.4, W-20)", () => {
  it("W-20: o modelo usa todas as variáveis, sem começar nem terminar com uma", () => {
    expect(modeloCorpoValido("Notícia do seu pedido {{1}} no {{2}}: {{3}}. Responda aqui.", 3)).toBe(true);
    expect(modeloCorpoValido("{{1}}: notícia {{2}} aqui.", 2)).toBe(false);
    expect(modeloCorpoValido("Notícia do pedido {{1}}", 1)).toBe(false);
    expect(modeloCorpoValido("Pedido {{1}} e {{3}} aqui.", 2)).toBe(false);
    expect(modeloCorpoValido("Pedido {{1}} com {chave} aqui.", 1)).toBe(false);
  });

  it("W-20: o modelo preenchido põe cada variável em parágrafo único e o rodapé no fim", () => {
    expect(renderizarModelo("Pedido {{1}}:\n\n{{2}}\n\nResponda aqui.", "Para não receber mais avisos, responda PARAR.", ["2026-0142", "Linha 1\nLinha 2"]))
      .toBe("Pedido 2026-0142:\n\nLinha 1 Linha 2\n\nResponda aqui.\n\nPara não receber mais avisos, responda PARAR.");
  });

  it("W-20: recusar ou pausar pede o motivo; o resto não", () => {
    expect(decidirModeloSchema.safeParse({ versao: 1, situacao: "RECUSADO" }).success).toBe(false);
    expect(decidirModeloSchema.safeParse({ versao: 1, situacao: "RECUSADO", motivo: "Texto promocional" }).success).toBe(true);
    expect(decidirModeloSchema.safeParse({ versao: 1, situacao: "APROVADO_PILOTO" }).success).toBe(true);
    expect(PROXIMAS_SITUACOES_MODELO.RASCUNHO).toEqual(["APROVADO_PILOTO", "ENVIADO"]);
    expect(LIMITE_FORA_DA_JANELA).toBe(800);
  });
});

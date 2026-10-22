import { describe, expect, it } from "vitest";
import {
  configWhatsappSchema,
  diaDaConversa,
  relatoDasMensagens,
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
    expect(configWhatsappSchema.safeParse({ versao: 1, foraHorario: "Curta", categoriaId: ID, prioridadeId: ID }).success).toBe(false);
    expect(configWhatsappSchema.safeParse({ versao: 1, foraHorario: "Recebemos fora do horário de atendimento.", categoriaId: ID,
                                            prioridadeId: ID }).success).toBe(true);
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

describe("A conversa de um número em A identificar (D4, B.1)", () => {
  it("separa os dias no horário de Brasília", () => {
    const agora = "2026-10-22T13:00:00Z";
    expect(diaDaConversa("2026-10-22T03:30:00Z", agora)).toBe("Hoje");
    // 00:30 de 22/10 em UTC ainda é 21/10 em Brasília.
    expect(diaDaConversa("2026-10-22T00:30:00Z", agora)).toBe("Ontem");
    expect(diaDaConversa("2026-10-18T14:20:00Z", agora)).toBe("18/10");
  });

  it("o relato junta os textos na ordem em que chegaram, sem as mensagens só de arquivo", () => {
    expect(relatoDasMensagens([
      { texto: "Mandei ontem: o portão travou", enviadaEm: "2026-10-16T09:00:00Z" },
      { texto: null, enviadaEm: "2026-10-15T21:41:00Z" },
      { texto: " O portão da garagem travou aberto. ", enviadaEm: "2026-10-15T21:40:00Z" },
    ])).toBe("O portão da garagem travou aberto.\nMandei ontem: o portão travou");
    expect(relatoDasMensagens([{ texto: "a".repeat(5000), enviadaEm: "2026-10-16T09:00:00Z" }])).toHaveLength(4000);
  });
});

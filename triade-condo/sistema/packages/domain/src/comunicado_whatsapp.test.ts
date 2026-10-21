import { describe, expect, it } from "vitest";
import {
  COMUNICADOS_WHATSAPP_POR_MINUTO, contagemDosCanais, corrigirComunicadoSchema, descreverEnvioWhatsapp, descreverEventoComunicado, minutosDoWhatsapp,
  salvarComunicadoSchema,
} from "./comunicados.ts";
import { buscaMoradoresSchema, ORIGENS_ACEITE_WHATSAPP, SITUACOES_COMUNICADOS_WHATSAPP } from "./moradores.ts";
import { comunicadosWhatsappSchema, FINALIDADES_ENVIO } from "./whatsapp.ts";

const BASE = { assunto: "AVISO", titulo: "Falta de água na quinta", texto: "Das 9h às 13h.", publico: "TODOS", acao: "PUBLICAR" };

describe("comunicado pelo WhatsApp do condomínio (F6.6)", () => {
  it("CD-02: o comunicado guarda se vai pelo WhatsApp; sem escolha, o banco mantém o que estava", () => {
    expect(salvarComunicadoSchema.parse({ ...BASE, porWhatsapp: false }).porWhatsapp).toBe(false);
    expect(salvarComunicadoSchema.parse(BASE).porWhatsapp).toBeNull();
    expect(salvarComunicadoSchema.safeParse({ ...BASE, porWhatsapp: "sim" }).success).toBe(false);
  });

  it("CD-01: corrigir só avisa de novo pelo WhatsApp quando pedido", () => {
    const corpo = { versao: 3, titulo: "Falta de água na quinta, das 10h", texto: "Das 10h às 14h.", mudanca: "O horário mudou." };
    expect(corrigirComunicadoSchema.parse(corpo).avisarWhatsapp).toBe(false);
    expect(corrigirComunicadoSchema.parse({ ...corpo, avisarWhatsapp: true }).avisarWhatsapp).toBe(true);
  });

  it("CD-02: a conta de por onde chega segue os canais ligados no comunicado", () => {
    const p = { contatos: 46, comEmail: 18, comWhatsapp: 21, pelosDois: 11 };
    expect(contagemDosCanais(p, { email: true, whatsapp: true })).toEqual({ email: 18, whatsapp: 21, pelosDois: 11, nenhum: 18 });
    expect(contagemDosCanais(p, { email: false, whatsapp: true })).toEqual({ email: 0, whatsapp: 21, pelosDois: 0, nenhum: 25 });
    expect(contagemDosCanais(p, { email: false, whatsapp: false }).nenhum).toBe(46);
  });

  it("W-14: as mensagens saem 10 por minuto, e a tela diz quanto tempo leva", () => {
    expect(COMUNICADOS_WHATSAPP_POR_MINUTO).toBe(10);
    expect([minutosDoWhatsapp(1), minutosDoWhatsapp(10), minutosDoWhatsapp(11), minutosDoWhatsapp(21)]).toEqual([1, 1, 2, 3]);
  });

  it("CD-08: como chegou pelo WhatsApp, sem dizer que enviada é lida", () => {
    expect(descreverEnvioWhatsapp({ entregues: 19, lidas: 12, falharam: 1, naFila: 1 })).toBe("19 entregues · 12 lidas · 1 falhou · 1 na fila");
    expect(descreverEnvioWhatsapp({ entregues: 1, canceladas: 2 })).toBe("1 entregue · 2 não saíram");
    expect(descreverEnvioWhatsapp({})).toBe("");
  });

  it("CD-08: o histórico do comunicado conta as mensagens que entraram na fila", () => {
    expect(descreverEventoComunicado("comunicado.whatsapp_na_fila", { numero: 1, quantos: 21 })).toBe("WhatsApp da versão 1: 21 mensagens na fila");
    expect(descreverEventoComunicado("comunicado.whatsapp_na_fila", { numero: 2, quantos: 1, corrigido: true }))
      .toBe('WhatsApp da versão 2, com "Corrigido:": 1 mensagem na fila');
  });

  it("W-20: a ficha diz a situação do aceite e por onde ele veio", () => {
    expect(SITUACOES_COMUNICADOS_WHATSAPP).toEqual({ ACEITOU: "aceitou", RECUSOU: "disse não", PAROU: "parou", SEM_RESPOSTA: "ainda não respondeu" });
    expect(ORIGENS_ACEITE_WHATSAPP.PERGUNTA).toBe("na conversa");
    expect(ORIGENS_ACEITE_WHATSAPP.COMANDO).toBe("pelo comando COMUNICADOS");
  });

  it("MU-01: a lista de contatos filtra quem não recebe comunicado pelo WhatsApp", () => {
    expect(buscaMoradoresSchema.parse({ estado: "SEM_WHATSAPP" }).estado).toBe("SEM_WHATSAPP");
  });

  it("CF-11: ligar e desligar pede a versão; a falha de comunicado tem nome próprio", () => {
    expect(comunicadosWhatsappSchema.safeParse({ versao: 4, ligado: true }).success).toBe(true);
    expect(comunicadosWhatsappSchema.safeParse({ versao: 4 }).success).toBe(false);
    expect(FINALIDADES_ENVIO.COMUNICADO).toBe("Comunicado");
  });
});

import { describe, expect, it } from "vitest";
import {
  CODIGO_MURAL,
  codigoLinkSchema,
  corrigirComunicadoSchema,
  decidirPedidoDocumentoSchema,
  descreverEnvioEmail,
  descreverEventoComunicado,
  descreverEventoDocumento,
  enviarDocumentoSchema,
  muralEmailSchema,
  pedirDocumentoSchema,
  salvarComunicadoSchema,
} from "./comunicados.ts";
import { buscaMoradoresSchema, emailContatoSchema, lerPlanilhaMoradores } from "./moradores.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";

describe("mural online e e-mail (CD-12 a CD-14)", () => {
  it("CD-12: o comunicado diz se vai ao mural e por e-mail; sem escolha, o banco decide", () => {
    const base = { assunto: "OBRAS", titulo: "Falta de água", texto: "Das 9h às 13h.", publico: "TODOS", acao: "RASCUNHO" };
    expect(salvarComunicadoSchema.parse(base)).toMatchObject({ noMural: null, porEmail: null });
    expect(salvarComunicadoSchema.parse({ ...base, noMural: false, porEmail: true })).toMatchObject({ noMural: false, porEmail: true });
  });

  it("CD-13: corrigir não reenvia sem pedir", () => {
    expect(corrigirComunicadoSchema.parse({ versao: 1, titulo: "Falta de água", texto: "Das 9h às 13h.", mudanca: "Horário" }).avisarEmail).toBe(false);
  });

  it("CD-12: o código do mural tem 12 caracteres sem os que se confundem", () => {
    expect(CODIGO_MURAL.test("7KQ2-X9MP-4WD8")).toBe(true);
    expect(CODIGO_MURAL.test("7KQ2-X9MP-4WD0")).toBe(false);
    expect(CODIGO_MURAL.test("7KQ2X9MP4WD8")).toBe(false);
    expect(codigoLinkSchema.safeParse({ codigo: "curto" }).success).toBe(false);
  });

  it("CD-12, CD-13: a configuração aceita resposta vazia e recusa e-mail inválido", () => {
    const base = { versao: 2, muralLigado: true, muralAssuntos: ["AVISO"], emailLigado: true, responderPara: "", documentosNoMural: true, documentosAutomatico: true };
    expect(muralEmailSchema.parse(base).responderPara).toBeNull();
    expect(muralEmailSchema.safeParse({ ...base, responderPara: "sindica@" }).success).toBe(false);
    expect(muralEmailSchema.safeParse({ ...base, muralAssuntos: ["QUALQUER"] }).success).toBe(false);
  });

  it("CD-13: o e-mail do contato vazio tira o e-mail", () => {
    expect(emailContatoSchema.parse({ versao: 1, email: "", recebe: true }).email).toBeNull();
    expect(emailContatoSchema.parse({ versao: 1, email: " marina@exemplo.com.br ", recebe: false }).email).toBe("marina@exemplo.com.br");
    expect(emailContatoSchema.safeParse({ versao: 1, email: "marina", recebe: true }).success).toBe(false);
    expect(buscaMoradoresSchema.parse({ estado: "SEM_EMAIL" }).estado).toBe("SEM_EMAIL");
  });

  it("CD-14: documento por e-mail para 1 a 20 pessoas; recusar pedido pede motivo", () => {
    expect(enviarDocumentoSchema.safeParse({ contatos: [], emails: [] }).success).toBe(false);
    expect(enviarDocumentoSchema.parse({ contatos: [U], emails: ["adv@exemplo.com"], recado: " " })).toEqual({ contatos: [U], emails: ["adv@exemplo.com"], recado: null });
    expect(enviarDocumentoSchema.safeParse({ emails: Array.from({ length: 21 }, (_, i) => `p${i}@exemplo.com`) }).success).toBe(false);
    expect(decidirPedidoDocumentoSchema.safeParse({ enviar: false, motivo: "" }).success).toBe(false);
    expect(decidirPedidoDocumentoSchema.safeParse({ enviar: true }).success).toBe(true);
    expect(pedirDocumentoSchema.safeParse({ documentoId: U, email: "sem-arroba" }).success).toBe(false);
  });

  it("MU-01: a planilha lê a coluna e-mail", () => {
    const r = lerPlanilhaMoradores("unidade;nome;telefone;e-mail\n101;Ana;61 99999-0001;ana@exemplo.com\n102;Beto;61 99999-0002;beto\n");
    expect(r.linhas[0]?.email).toBe("ana@exemplo.com");
    expect(r.erros).toEqual([{ linha: 3, campos: ["email"] }]);
  });

  it("CD-13: o que aconteceu com os e-mails, numa linha", () => {
    expect(descreverEnvioEmail({ entregues: 35, devolvidos: 2, spam: 1 })).toBe("35 entregues · 2 voltaram · 1 marcou como spam");
    expect(descreverEnvioEmail({ entregues: 1, naFila: 3 })).toBe("1 entregue · 3 na fila");
    expect(descreverEventoComunicado("comunicado.email_na_fila", { numero: 2, quantos: 38 })).toBe("E-mail da versão 2 para 38 contatos");
    expect(descreverEventoComunicado("comunicado.mural_tirado", {})).toBe("Tirado do mural online");
    expect(descreverEventoDocumento("documento.pedido", { automatico: true })).toBe("Pedido pelo mural e enviado na hora");
    expect(descreverEventoDocumento("documento.aberto_por_email", { numero: 3 })).toBe("Versão 3 aberta pelo link do e-mail");
  });
});

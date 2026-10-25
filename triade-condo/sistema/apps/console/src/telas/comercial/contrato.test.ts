// Contrato pelo gov.br nas telas (R17.4; quadros 440 a 444; CM-13): o selo e o texto de cada
// assinatura, na ordem (condomínio e depois TRÍADE), o estado do alto, os campos preenchidos, a
// revisão do advogado e o que o arquivo precisa ter antes de subir.
import { describe, expect, it } from "vitest";
import {
  apoioAssinatura, assinadas, documentoExemplo, documentosAtuais, estadoDoContrato, hashCurto, linhasCampos, problemaDoDocumento, problemaDoPdf, seloAssinatura,
  textoDoEnvio, textoDocumento, textoFaltaModelo, textoRevisao, type ContratoTela, type DocumentoTela, type EnvioTela, type RespostaContrato,
} from "./contrato.ts";

const CONTRATO: ContratoTela = {
  id: "c1", versao: 1, numero: 1, situacao: "AGUARDA_CONDOMINIO", hash: "9f2c00000000000000000000000041ab", geradoEm: "2026-10-30T13:00:00Z",
  assinaturas: { condominio: { situacao: "AGUARDANDO" }, triade: { situacao: "ESPERA_CONDOMINIO" } }, podeBaixar: true, finalDisponivel: false,
};
const R = (x: Partial<RespostaContrato>) => ({ interessado: { id: "i", versao: 1, condominio: "Residencial Cerrado", etapa: "APROVACAO" }, anteriores: [], ...x });

describe("Assinaturas", () => {
  it("condomínio primeiro, depois a TRÍADE (quadro 440)", () => {
    expect(seloAssinatura(CONTRATO.assinaturas.condominio, "CONDOMINIO", CONTRATO)).toEqual({ texto: "Aguardando", tom: "neutro" });
    expect(seloAssinatura(CONTRATO.assinaturas.triade, "TRIADE", CONTRATO)).toEqual({ texto: "Espera o condomínio", tom: "neutro" });
    const vez = { ...CONTRATO, situacao: "AGUARDA_TRIADE" as const };
    expect(seloAssinatura({ situacao: "AGUARDANDO" }, "TRIADE", vez)).toEqual({ texto: "Sua vez", tom: "atencao" });
    expect(apoioAssinatura({ situacao: "AGUARDANDO" }, "TRIADE", vez)).toContain("já assinado pelo condomínio");
    expect(seloAssinatura({ situacao: "A_CONFERIR" }, "CONDOMINIO", CONTRATO).texto).toBe("Falta conferir");
    expect(seloAssinatura({ situacao: "CONFERIDA" }, "CONDOMINIO", CONTRATO).tom).toBe("ok");
  });

  it("conta quantas foram conferidas", () => {
    expect(assinadas(CONTRATO)).toBe(0);
    expect(assinadas({ assinaturas: { condominio: { situacao: "CONFERIDA" }, triade: { situacao: "A_CONFERIR" } } })).toBe(1);
  });

  it("diz quem conferiu e quando", () => {
    expect(apoioAssinatura({ situacao: "CONFERIDA", conferidoEm: "2026-10-31T14:05:00Z", assinanteNome: "Lúcia Prado" }, "CONDOMINIO", CONTRATO))
      .toBe("Conferida em 31/10 11:05 no validar.iti.gov.br · Lúcia Prado.");
    expect(apoioAssinatura({ situacao: "RECUSADA", motivoTexto: "Assinou com outro CPF." }, "CONDOMINIO", CONTRATO)).toBe("Assinou com outro CPF.");
  });

  it("encurta a impressão digital", () => {
    expect(hashCurto(CONTRATO.hash)).toBe("9f2c…41ab");
    expect(hashCurto("abc")).toBe("abc");
  });
});

describe("Estados do contrato (quadro 444)", () => {
  const envio = (x: Partial<EnvioTela>): EnvioTela => ({ id: "e", parte: "CONDOMINIO", situacao: "A_CONFERIR", enviadoEm: "2026-10-31T13:00:00Z", ...x });

  it("sem contrato: sem modelo, falta documento, sem aceite", () => {
    expect(estadoDoContrato(R({ motivoSemGerar: "SEM_MODELO_CONTRATO" }))?.titulo).toBe("Sem modelo em uso");
    expect(estadoDoContrato(R({ motivoSemGerar: "FALTA_DOCUMENTO" }))?.titulo).toBe("Falta CNPJ ou ata");
    expect(estadoDoContrato(R({ motivoSemGerar: "SEM_ACEITE" }))?.chave).toBe("SEM_ACEITE");
    expect(estadoDoContrato(R({}))).toBeNull();
  });

  it("o último envio diz por que não serviu", () => {
    expect(estadoDoContrato(R({ contrato: CONTRATO, envios: [envio({ situacao: "RECUSADO_NA_HORA", motivo: "SEM_ASSINATURA" })] }))?.titulo).toBe("Arquivo sem assinatura");
    expect(estadoDoContrato(R({ contrato: CONTRATO, envios: [envio({ situacao: "NAO_E_O_GERADO" })] }))?.titulo).toBe("Não é o contrato gerado");
    const recusa = estadoDoContrato(R({ contrato: CONTRATO, envios: [envio({ situacao: "RECUSADO", recusa: { motivo: "Assinou com outro CPF", por: { id: "x", nome: "Carolina" }, em: "2026-10-31T13:00:00Z" } })] }));
    expect(recusa?.texto).toContain("Carolina recusou em 31/10/2026: Assinou com outro CPF");
    expect(estadoDoContrato(R({ contrato: CONTRATO, envios: [envio({})] }))).toBeNull();
  });

  it("assinado, gerado de novo e link fechado", () => {
    expect(estadoDoContrato(R({ contrato: { ...CONTRATO, situacao: "ASSINADO" } }))?.tom).toBe("ok");
    expect(estadoDoContrato(R({ contrato: { ...CONTRATO, numero: 2 }, anteriores: [{ id: "a", numero: 1, geradoEm: "2026-10-29" }] }))?.texto).toContain("nº 1");
    expect(estadoDoContrato(R({ motivoSemGerar: "INTERESSADO_FECHADO", contrato: CONTRATO }))?.chave).toBe("LINK_FECHADO");
  });
});

describe("Campos, modelo e arquivos", () => {
  it("mostra os campos preenchidos na ordem do modelo", () => {
    expect(linhasCampos({ valor_mensal: "R$ 229,00", condominio: "Residencial Cerrado", cnpj: "" })).toEqual([["Nome do condomínio", "Residencial Cerrado"], ["Mensalidade", "R$ 229,00"]]);
  });

  it("escreve a revisão do advogado e o que falta para usar", () => {
    expect(textoRevisao({ revisao: { advogado: "Rui Barros", oab: "DF 12345", em: "2026-10-20" } })).toBe("Revisado por Rui Barros, OAB DF 12345, em 20/10/2026");
    expect(textoRevisao({})).toBe("Sem revisão de advogado");
    expect(textoFaltaModelo(["revisao", "termo"])).toBe("Para usar falta a revisão do advogado (nome, OAB e data), o termo de tratamento de dados.");
    expect(textoFaltaModelo([])).toBe("");
  });

  it("monta o PDF de exemplo com os campos à vista", () => {
    const d = documentoExemplo({ numero: 2, titulo: "Contrato de prestação", texto: "Contratante: «condominio».\n\nInício: «data_inicio».", termo: "Dados: «representante»." });
    expect(d.blocos[0]).toEqual({ tipo: "paragrafo", texto: "Contratante: [Nome do condomínio]." });
    expect(d.blocos.some((b) => b.tipo === "secao" && b.texto === "Termo de tratamento de dados")).toBe(true);
    expect(d.nomeArquivo).toBe("modelo-contrato-v2-exemplo.pdf");
  });

  it("só aceita PDF até 10 MB", () => {
    expect(problemaDoPdf({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(problemaDoPdf({ name: "a.png", type: "image/png", size: 1000 })).toBe("Envie um arquivo PDF.");
    expect(problemaDoPdf({ name: "a.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })).toBe("O arquivo passa de 10 MB.");
    expect(problemaDoPdf({ name: "a.pdf", type: "", size: 0 })).toBe("O arquivo está vazio.");
  });

  it("confere o CNPJ e o fim do mandato antes de enviar", () => {
    expect(problemaDoDocumento("CNPJ", { cnpj: "11.222.333/0001-81" }, "2026-10-30")).toBeNull();
    expect(problemaDoDocumento("CNPJ", { cnpj: "11.222.333/0001-80" }, "2026-10-30")?.campo).toBe("cnpj");
    expect(problemaDoDocumento("ATA_ELEICAO", {}, "2026-10-30")?.texto).toBe("Diga até quando vai o mandato.");
    expect(problemaDoDocumento("ATA_ELEICAO", { mandatoAte: "2026-01-01" }, "2026-10-30")?.texto).toContain("já acabou");
    expect(problemaDoDocumento("ATA_APROVACAO", {}, "2026-10-30")).toBeNull();
  });

  it("mostra o documento que vale de cada tipo", () => {
    const d = (x: Partial<DocumentoTela>): DocumentoTela => ({ id: "d", tipo: "CNPJ", situacao: "RECEBIDO", nome: "cnpj.pdf", enviadoEm: "2026-10-30T13:00:00Z", ...x });
    const atuais = documentosAtuais([d({ id: "2", situacao: "RECUSADO", motivo: "ILEGIVEL" }), d({ id: "1" }), d({ id: "3", tipo: "ATA_ELEICAO", situacao: "SUBSTITUIDO" })]);
    expect(atuais.CNPJ?.id).toBe("1");
    expect(atuais.ATA_ELEICAO).toBeUndefined();
    expect(textoDocumento(d({ peloLink: true, cnpj: "11.222.333/0001-81" }))).toBe("cnpj.pdf · enviado 30/10 pelo link · CNPJ 11.222.333/0001-81");
  });

  it("diz o que aconteceu com o PDF enviado", () => {
    expect(textoDoEnvio({ situacao: "A_CONFERIR" }).ok).toBe(true);
    expect(textoDoEnvio({ situacao: "RECUSADO_NA_HORA", motivoTexto: "Sem assinatura." })).toEqual({ ok: false, texto: "Sem assinatura." });
  });
});

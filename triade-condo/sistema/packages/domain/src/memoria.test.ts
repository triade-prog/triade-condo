import { describe, expect, it } from "vitest";
import {
  anotacaoSchema,
  buscaHistoricoProntuarioSchema,
  buscaLinhaDoTempoSchema,
  descreverHistoricoProntuario,
  guardarContratoPrestadorSchema,
  ligarContratoPrestadorSchema,
  descreverEventoMemoria,
  documentoPareceDoItem,
  enderecoParteDocumentos,
  itemProntuarioSchema,
  nomeNoDossie,
  ordenarParaLigar,
  parteDaAbaAntiga,
  rotuloSituacaoProntuario,
  secaoManualSchema,
} from "./index.ts";

const ID = "4b9c1f7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("prontuário (MP-12)", () => {
  it("o selo diz quantos dias faltam para vencer", () => {
    expect(rotuloSituacaoProntuario("VENCE", "2026-11-30", "2026-10-18")).toBe("Vence em 43 dias");
    expect(rotuloSituacaoProntuario("VENCE", "2026-10-19", "2026-10-18")).toBe("Vence amanhã");
    expect(rotuloSituacaoProntuario("VENCEU", "2026-10-02", "2026-10-18")).toBe("Venceu");
    expect(rotuloSituacaoProntuario("NAO_SE_APLICA", null, "2026-10-18")).toBe("Não se aplica");
  });

  it("ligar pede o documento; não se aplica pede motivo", () => {
    expect(itemProntuarioSchema.parse({ acao: "LIGAR", documentoId: ID })).toMatchObject({ avisarDias: 60 });
    expect(itemProntuarioSchema.safeParse({ acao: "LIGAR" }).success).toBe(false);
    expect(itemProntuarioSchema.safeParse({ acao: "NAO_SE_APLICA", motivo: " " }).success).toBe(false);
    expect(itemProntuarioSchema.safeParse({ acao: "LIGAR", documentoId: ID, avisarDias: 400 }).success).toBe(false);
  });
});

describe("memória (CT-03)", () => {
  it("a anotação liga a uma coisa só", () => {
    const base = { tipo: "COMBINADO", titulo: "Muro com o lote 12", texto: "Metade cada", aconteceuEm: "2026-10-10" };
    expect(anotacaoSchema.parse(base)).toMatchObject({ documentoId: null, pedidoId: null, manutencaoId: null });
    expect(anotacaoSchema.safeParse({ ...base, documentoId: ID, manutencaoId: ID }).success).toBe(false);
  });

  it("o histórico vira frase", () => {
    expect(descreverEventoMemoria("prontuario.nao_se_aplica", { item: "Potabilidade", motivo: "Sem poço" }))
      .toBe("Potabilidade: não se aplica. Motivo: Sem poço");
    expect(descreverEventoMemoria("memoria.exportacao_baixada", { pacote: 2 })).toBe("Exportação baixada (pacote 2)");
  });
});

describe("manual do prédio (MP-14)", () => {
  it("resumo vazio vira nulo", () => {
    expect(secaoManualSchema.parse({ titulo: "Água e gás", resumo: " ", texto: "Registro na casa de bombas" }).resumo).toBeNull();
  });
});

describe("Documentos e memória (DC15, decisões de 22/10/2026)", () => {
  it("o endereço antigo leva à parte nova; Passagem e Exportar viram uma parte só", () => {
    expect(parteDaAbaAntiga("exportar")).toBe("passagem");
    expect(parteDaAbaAntiga("passagem")).toBe("passagem");
    expect(parteDaAbaAntiga("linha")).toBe("linha");
    expect(parteDaAbaAntiga(null)).toBe("prontuario");
    expect(enderecoParteDocumentos("documentos")).toBe("/documentos");
    expect(enderecoParteDocumentos("manual")).toBe("/documentos/manual");
  });
  it("o documento solto do mesmo tipo e com o nome parecido sugere o item", () => {
    expect(documentoPareceDoItem("SPDA", { titulo: "Laudo SPDA 2026", tipo: "LAUDO" })).toBe(true);
    expect(documentoPareceDoItem("ELEVADORES", { titulo: "Laudo SPDA 2026", tipo: "LAUDO" })).toBe(false);
    expect(documentoPareceDoItem("SPDA", { titulo: "SPDA", tipo: "OUTRO" })).toBe(false);
    expect(documentoPareceDoItem("AGUA", { titulo: "Potabilidade da água", tipo: "LAUDO" })).toBe(true);
    expect(documentoPareceDoItem(undefined, { titulo: "Laudo SPDA 2026", tipo: "LAUDO" })).toBe(false);
  });
  it("para ligar, os do tipo esperado vêm primeiro, com o mais parecido no topo", () => {
    const docs = [{ titulo: "Convenção", tipo: "CONVENCAO" }, { titulo: "AVCB 2025", tipo: "LAUDO" }, { titulo: "Laudo SPDA 2026", tipo: "LAUDO" }];
    const r = ordenarParaLigar("SPDA", docs);
    expect(r.mesmoTipo.map((d) => d.titulo)).toEqual(["Laudo SPDA 2026", "AVCB 2025"]);
    expect(r.outros.map((d) => d.titulo)).toEqual(["Convenção"]);
    expect(ordenarParaLigar(undefined, docs).mesmoTipo).toEqual([]);
  });
  it("no dossiê, o tipo não se repete quando é o próprio título", () => {
    expect(nomeNoDossie("Convenção", "Convenção")).toBe("Convenção");
    expect(nomeNoDossie("AVCB 2025", "Laudo e certificado")).toBe("Laudo e certificado: AVCB 2025");
  });

  it("D.3: a linha do tempo aceita a busca e o período, com o fim depois do começo", () => {
    expect(buscaLinhaDoTempoSchema.parse({ busca: "  bomba ", de: "2026-01-01", ate: "2026-10-31" })).toMatchObject({ filtro: "TUDO", busca: "bomba" });
    expect(buscaLinhaDoTempoSchema.parse({ busca: "  " }).busca).toBeUndefined();
    expect(buscaLinhaDoTempoSchema.safeParse({ de: "2026-10-31", ate: "2026-01-01" }).error?.issues[0]?.path).toEqual(["ate"]);
    expect(buscaLinhaDoTempoSchema.safeParse({ busca: "x".repeat(61) }).success).toBe(false);
  });

  it("D.1: o histórico do prontuário diz o que mudou, em que item e quem fez", () => {
    expect(buscaHistoricoProntuarioSchema.safeParse({ item: "AVCB" }).success).toBe(false);
    const base = { id: "1", quando: "2026-10-14T13:00:00Z", data: "2026-10-14", item: "Apólice do seguro obrigatório", autor: "Ana Souza" };
    expect(descreverHistoricoProntuario({ ...base, acao: "LIGAR", documento: "Apólice 2026", avisarDias: 60 })).toEqual({
      titulo: "Documento ligado: Apólice 2026", detalhe: "Apólice do seguro obrigatório · avisa 60 dias antes · Ana Souza",
    });
    expect(descreverHistoricoProntuario({ ...base, acao: "NAO_SE_APLICA", motivo: "Prédio sem poço" }).detalhe).toBe("Apólice do seguro obrigatório · “Prédio sem poço” · Ana Souza");
    expect(descreverHistoricoProntuario({ ...base, acao: "VENCEU", autor: undefined, documento: "AVCB 2025" })).toEqual({
      titulo: "Venceu: AVCB 2025", detalhe: "Apólice do seguro obrigatório · Sozinho, pela data de validade",
    });
    expect(descreverHistoricoProntuario({ ...base, acao: "ITEM_CRIADO", grupo: "LAUDOS" }).detalhe).toBe("Apólice do seguro obrigatório · Laudos e certificados · Ana Souza");
  });

  it("D.2: o contrato do prestador é um documento do tipo Contrato", () => {
    const doc = { tipo: "CONTRATO", titulo: "Contrato com a HidroPress", valeAte: "2027-03-15" };
    expect(guardarContratoPrestadorSchema.safeParse({ versao: 2, documento: doc }).success).toBe(true);
    expect(guardarContratoPrestadorSchema.safeParse({ versao: 2, documento: { ...doc, tipo: "ATA" } }).success).toBe(false);
    expect(ligarContratoPrestadorSchema.parse({ versao: 2, documentoId: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d" }).valeAte).toBeNull();
  });
});

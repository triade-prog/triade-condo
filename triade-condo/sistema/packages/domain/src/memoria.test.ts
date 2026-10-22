import { describe, expect, it } from "vitest";
import {
  anotacaoSchema,
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
});

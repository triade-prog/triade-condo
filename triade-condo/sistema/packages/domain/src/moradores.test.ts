import { describe, expect, it } from "vitest";
import { descreverEvento } from "./eventos.ts";
import {
  chaveAndar,
  chaveUnidade,
  gerarUnidades,
  incluirContatoSchema,
  lerPlanilhaMoradores,
  MODELO_PLANILHA,
  mudancaSchema,
  nomeDaUnidade,
  telefoneContato,
} from "./moradores.ts";

const V = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";

describe("moradores e unidades (passo 3)", () => {
  it("MU-01: telefone como a pessoa digita vira o formato do banco", () => {
    expect(telefoneContato.parse("(61) 99999-0001")).toBe("+5561999990001");
    expect(telefoneContato.parse("+55 61 3333-0000")).toBe("+556133330000");
    expect(telefoneContato.safeParse("99999-0001").success).toBe(false);
  });

  it("MU-01: contato novo precisa de nome e telefone; o que já existe vai pelo id", () => {
    expect(incluirContatoSchema.safeParse({ nome: "Marina", relacao: "MORADOR" }).success).toBe(false);
    expect(incluirContatoSchema.safeParse({ contatoId: V, relacao: "PROPRIETARIO" }).success).toBe(true);
    expect(incluirContatoSchema.safeParse({ nome: "Marina", telefone: "61999990001", relacao: "VIZINHO" }).success).toBe(false);
  });

  it("numeração de prédio: andar e posição, térreo sem o zero", () => {
    const ids = (l: { identificacao: string }[]) => l.map((u) => u.identificacao);
    expect(ids(gerarUnidades({ de: 1, ate: 2, porAndar: 3 }))).toEqual(["101", "102", "103", "201", "202", "203"]);
    expect(ids(gerarUnidades({ de: 0, ate: 0, porAndar: 2 }))).toEqual(["1", "2"]);
    expect(ids(gerarUnidades({ de: 10, ate: 10, porAndar: 1 }))).toEqual(["1001"]);
    expect(gerarUnidades({ de: 1, ate: 200, porAndar: 10 })).toEqual([]);
    expect(gerarUnidades({ de: 1, ate: 1, porAndar: 1 })[0]!.andar).toBeNull();
  });

  it("torre e andar: cada unidade gerada já sai com o andar; nome só com as partes que existem", () => {
    expect(gerarUnidades({ de: 0, ate: 1, porAndar: 1, comAndar: true })).toEqual([
      { identificacao: "1", andar: "Térreo" }, { identificacao: "101", andar: "1" }]);
    expect(nomeDaUnidade("Torre A", "3", "302")).toBe("Torre A · 3º andar · 302");
    expect(nomeDaUnidade(null, "Cobertura", "1")).toBe("Cobertura · 1");
    expect(nomeDaUnidade(null, null, "Casa 2")).toBe("Casa 2");
    expect(["10", "Cobertura", "2", "Térreo", "Subsolo 1"].sort((a, b) => chaveAndar(a).localeCompare(chaveAndar(b))))
      .toEqual(["Subsolo 1", "Térreo", "2", "10", "Cobertura"]);
  });

  it("ordem natural igual à do banco", () => {
    const l = ["Loja 10", "1001", "101", "Loja 2", "201"];
    expect([...l].sort((a, b) => chaveUnidade(a).localeCompare(chaveUnidade(b)))).toEqual(["101", "201", "1001", "Loja 2", "Loja 10"]);
  });

  it("MU-07: mudança diz quem sai ou quem entra, com um principal no máximo", () => {
    expect(mudancaSchema.safeParse({ data: "2026-10-01", saem: [], entram: [] }).success).toBe(false);
    const entra = { nome: "Caio", telefone: "61966660001", relacao: "INQUILINO", principal: true };
    expect(mudancaSchema.safeParse({ data: "2026-10-01", saem: [], entram: [entra, entra] }).success).toBe(false);
    expect(mudancaSchema.safeParse({ data: "2026-02-30", saem: [{ id: V, versao: 1 }], entram: [] }).success).toBe(false);
    expect(mudancaSchema.safeParse({ data: "2026-10-01", saem: [{ id: V, versao: 1 }], entram: [entra] }).success).toBe(true);
  });

  it("F3.3: lê a planilha do Excel (ponto e vírgula, acento, aspas) e aponta a linha errada", () => {
    const csv = "\uFEFFTorre;Apto;Nome;Celular;Tipo\r\n" +
      "A;101;Marina Souza;(61) 99999-0001;Proprietária\r\n" +
      'A;102;"Lima; Joana";61988887777;\r\n' +
      "B;;Rui;123;vizinho\r\n" +
      ";Loja 2;Padaria Sol;+55 61 3333-0000;Outro\r\n";
    const r = lerPlanilhaMoradores(csv);
    expect(r.faltam).toEqual([]);
    expect(r.linhas).toEqual([
      { bloco: "A", andar: null, unidade: "101", nome: "Marina Souza", telefone: "+5561999990001", relacao: "PROPRIETARIO" },
      { bloco: "A", andar: null, unidade: "102", nome: "Lima; Joana", telefone: "+5561988887777", relacao: "MORADOR" },
      { bloco: null, andar: null, unidade: "Loja 2", nome: "Padaria Sol", telefone: "+556133330000", relacao: "OUTRO" },
    ]);
    expect(r.agrupamento).toBe("TORRE");
    expect(r.erros).toEqual([{ linha: 4, campos: ["unidade", "telefone", "relacao"] }]);
    expect(r.origens).toEqual([2, 3, 5]);
  });

  it("F3.3: planilha com vírgula e sem coluna de telefone diz o que falta", () => {
    expect(lerPlanilhaMoradores("unidade,nome\n101,Ana\n").faltam).toEqual(["telefone"]);
    expect(lerPlanilhaMoradores("unidade,nome,telefone\n101,Ana,61999990001\n").linhas).toHaveLength(1);
    expect(lerPlanilhaMoradores(MODELO_PLANILHA).linhas).toEqual([
      { bloco: "Torre A", andar: "1", unidade: "101", nome: "Maria Exemplo", telefone: "+5561999990000", relacao: "PROPRIETARIO" }]);
    expect(lerPlanilhaMoradores("Quadra;Pavimento;Casa;Nome;Fone\nQ1;Térreo;3;Ana;61999990001\n").linhas[0])
      .toMatchObject({ bloco: "Q1", andar: "Térreo", unidade: "3" });
  });

  it("o histórico da unidade em frases, sem nome nem telefone", () => {
    expect(descreverEvento({ acao: "estado.mudou", entidade: "contatos_unidade", dados: { de: "CONFIRMADO", para: "ENCERRADO", motivo: "MUDANCA" } }))
      .toBe("Contato saiu da unidade · Mudou-se");
    expect(descreverEvento({ acao: "mudanca.registrada", entidade: "unidade", dados: { data: "2026-10-01", saem: 2, entram: 1 } }))
      .toBe("Mudança registrada em 01/10/2026: 2 saíram, 1 entraram");
  });
});

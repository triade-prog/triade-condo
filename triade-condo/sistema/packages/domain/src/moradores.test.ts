import { describe, expect, it } from "vitest";
import { descreverEvento } from "./eventos.ts";
import {
  alterarVinculoUnidadeSchema,
  chaveAndar,
  chaveUnidade,
  gerarUnidades,
  incluirContatoSchema,
  lerPlanilhaMoradores,
  marcasDaRelacao,
  marcasSchema,
  MODELO_PLANILHA,
  mudancaSchema,
  nomeDaUnidade,
  relacaoDasMarcas,
  RELACOES_UNIDADE,
  type RelacaoUnidade,
  telefoneContato,
} from "./moradores.ts";

const SEM = { mora: null, responsavel: null, parentesco: null, ocupaDesde: null };

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
    const entra = { nome: "Caio", telefone: "61966660001", mora: true, ligacao: "INQUILINO", principal: true };
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
      { bloco: "A", andar: null, unidade: "101", nome: "Marina Souza", telefone: "+5561999990001", relacao: "PROPRIETARIO", ...SEM },
      { bloco: "A", andar: null, unidade: "102", nome: "Lima; Joana", telefone: "+5561988887777", relacao: "MORADOR", ...SEM },
      { bloco: null, andar: null, unidade: "Loja 2", nome: "Padaria Sol", telefone: "+556133330000", relacao: "OUTRO", ...SEM },
    ]);
    expect(r.agrupamento).toBe("TORRE");
    expect(r.erros).toEqual([{ linha: 4, campos: ["unidade", "telefone", "relacao"] }]);
    expect(r.origens).toEqual([2, 3, 5]);
  });

  it("F3.3: planilha com vírgula e sem coluna de telefone diz o que falta", () => {
    expect(lerPlanilhaMoradores("unidade,nome\n101,Ana\n").faltam).toEqual(["telefone"]);
    expect(lerPlanilhaMoradores("unidade,nome,telefone\n101,Ana,61999990001\n").linhas).toHaveLength(1);
    expect(lerPlanilhaMoradores(MODELO_PLANILHA).linhas).toEqual([
      { bloco: "Torre A", andar: "1", unidade: "101", nome: "Maria Exemplo", telefone: "+5561999990000", relacao: "PROPRIETARIO",
        mora: true, responsavel: true, parentesco: null, ocupaDesde: null },
      { bloco: "Torre A", andar: "1", unidade: "101", nome: "João Exemplo", telefone: "+5561999990001", relacao: "FAMILIAR",
        mora: true, responsavel: false, parentesco: "FILHO", ocupaDesde: "2025-03-01" }]);
    expect(lerPlanilhaMoradores("Quadra;Pavimento;Casa;Nome;Fone\nQ1;Térreo;3;Ana;61999990001\n").linhas[0])
      .toMatchObject({ bloco: "Q1", andar: "Térreo", unidade: "3" });
  });

  it("MU-10: as três marcações, a ligação e o parentesco seguem as regras do banco", () => {
    expect(marcasSchema.parse({ proprietario: true, principal: true, mora: true }))
      .toEqual({ proprietario: true, principal: true, mora: true, ligacao: null, parentesco: null, ocupaDesde: null });
    expect(marcasSchema.safeParse({ mora: true }).success).toBe(false);
    expect(marcasSchema.safeParse({ proprietario: true, ligacao: "INQUILINO" }).success).toBe(false);
    expect(marcasSchema.safeParse({ ligacao: "OUTRO", parentesco: "FILHO" }).success).toBe(false);
    expect(marcasSchema.safeParse({ ligacao: "FAMILIAR", parentesco: "FILHO", ocupaDesde: "2025-03-01" }).success).toBe(true);
    expect(marcasSchema.safeParse({ ligacao: "OUTRO", ocupaDesde: "01/03/2025" }).success).toBe(false);
    for (const r of Object.keys(RELACOES_UNIDADE) as RelacaoUnidade[]) expect(relacaoDasMarcas(marcasDaRelacao(r))).toBe(r);
  });

  it("MU-10: a tela de antes, com a relação, vira marcações", () => {
    expect(incluirContatoSchema.parse({ nome: "Ana", telefone: "61999990001", relacao: "INQUILINO", principal: true }).marcas)
      .toEqual({ proprietario: false, principal: true, mora: true, ligacao: "INQUILINO", parentesco: null, ocupaDesde: null });
    expect(alterarVinculoUnidadeSchema.parse({ versao: 1, relacao: "OUTRO", principal: false, recebeComunicados: true }).marcas.mora).toBe(false);
    expect(mudancaSchema.parse({ data: "2026-10-01", saem: [], entram: [{ nome: "Caio", telefone: "61966660001", mora: true, ligacao: "INQUILINO" }] })
      .entram[0]).toMatchObject({ proprietario: false, mora: true, ligacao: "INQUILINO", principal: false });
  });

  it("F3.3: colunas novas da planilha (mora, responsável, parentesco, ocupa desde)", () => {
    const csv = "Unidade;Nome;Telefone;Relação;Mora na unidade;Responsável pela unidade;Parentesco;Ocupa desde\n" +
      "101;Ana;61999990001;Esposa;sim;;;1/3/2025\n" +
      "102;Bia;61999990002;Proprietária;não;x;;\n" +
      "103;Cid;61999990003;Inquilino;talvez;;;31/02/2025\n" +
      "104;Davi;61999990004;Inquilino;sim;;Filho;\n";
    const r = lerPlanilhaMoradores(csv);
    expect(r.linhas).toEqual([
      { bloco: null, andar: null, unidade: "101", nome: "Ana", telefone: "+5561999990001", relacao: "FAMILIAR",
        mora: true, responsavel: null, parentesco: "CONJUGE", ocupaDesde: "2025-03-01" },
      { bloco: null, andar: null, unidade: "102", nome: "Bia", telefone: "+5561999990002", relacao: "PROPRIETARIO",
        mora: false, responsavel: true, parentesco: null, ocupaDesde: null },
    ]);
    expect(r.erros).toEqual([{ linha: 4, campos: ["mora", "ocupaDesde"] }, { linha: 5, campos: ["parentesco"] }]);
    expect(lerPlanilhaMoradores("Unidade;Responsável;Telefone\n101;Ana;61999990001\n").linhas[0]!.nome).toBe("Ana");
  });

  it("o histórico da unidade em frases, sem nome nem telefone", () => {
    expect(descreverEvento({ acao: "estado.mudou", entidade: "contatos_unidade", dados: { de: "CONFIRMADO", para: "ENCERRADO", motivo: "MUDANCA" } }))
      .toBe("Contato saiu da unidade · Mudou-se");
    expect(descreverEvento({ acao: "mudanca.registrada", entidade: "unidade", dados: { data: "2026-10-01", saem: 2, entram: 1 } }))
      .toBe("Mudança registrada em 01/10/2026: 2 saíram, 1 entraram");
    expect(descreverEvento({ acao: "vinculo_unidade.alterado", entidade: "contato_unidade", dados: { campos: ["responsavel", "ocupa_desde"] } }))
      .toBe("Vínculo alterado: responsável, ocupa desde");
  });
});

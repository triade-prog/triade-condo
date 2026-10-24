// Decisões e aprovações (R5): o conselho (V-14) e a despesa para aprovar (FC-10).
import { describe, expect, it } from "vitest";
import {
  alterarDespesaSchema,
  ausenciaSchema,
  avisoAlcada,
  criarDespesaSchema,
  descreverEventoAprovacao,
  incluirMembroSchema,
  pagarDespesaSchema,
  regrasDecisoesSchema,
  respostaConselhoSchema,
  resumoDespesa,
  textoEscolha,
  textoFaltam,
  textoMandato,
  textoVotacao,
  votoSchema,
} from "./aprovacoes.ts";
import { descreverEventoDecisao, pedirDecisaoSchema } from "./decisoes.ts";

const ID = "6f2c7c1e-2a5b-4c1d-9e3f-0a1b2c3d4e5f";
const campos = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) => r.error?.issues.map((i) => String(i.path[0]));

describe("o conselho (V-14)", () => {
  const mandato = { papel: "CONSELHEIRO", mandatoInicio: "2026-01-01", mandatoFim: "2027-12-31", canal: "EMAIL", email: "lucia@exemplo.com" };
  it("entra a pessoa com acesso, o morador ou só o nome e o contato", () => {
    expect(incluirMembroSchema.parse({ ...mandato, nome: " Lúcia Prado " })).toMatchObject({ nome: "Lúcia Prado", pessoaId: null, contatoId: null, celular: null });
    expect(incluirMembroSchema.parse({ ...mandato, pessoaId: ID }).nome).toBeNull();
    expect(campos(incluirMembroSchema.safeParse({ ...mandato }))).toEqual(["nome"]);
    expect(campos(incluirMembroSchema.safeParse({ ...mandato, pessoaId: ID, contatoId: ID }))).toEqual(["pessoaId"]);
  });
  it("confere o papel, o mandato e o e-mail", () => {
    expect(campos(incluirMembroSchema.safeParse({ ...mandato, nome: "Lúcia", papel: "PRESIDENTE" }))).toEqual(["papel"]);
    expect(campos(incluirMembroSchema.safeParse({ ...mandato, nome: "Lúcia", mandatoFim: "2025-12-31" }))).toEqual(["mandatoFim"]);
    expect(campos(incluirMembroSchema.safeParse({ ...mandato, nome: "Lúcia", email: "lucia" }))).toEqual(["email"]);
  });
  it("as regras: o mínimo pede quantos votos; a alçada é em centavos", () => {
    const base = { versao: 1, quorum: "MAIORIA", empate: "SINDICO", vencidaAvisa: "NINGUEM" };
    expect(regrasDecisoesSchema.parse({ ...base, alcada: 500000 })).toMatchObject({ minimo: null, alcada: 500000 });
    expect(campos(regrasDecisoesSchema.safeParse({ ...base, quorum: "MINIMO" }))).toEqual(["minimo"]);
    expect(campos(regrasDecisoesSchema.safeParse({ ...base, alcada: 10.5 }))).toEqual(["alcada"]);
  });
  it("a ausência: o fim vem depois do começo", () => {
    expect(campos(ausenciaSchema.safeParse({ de: "2026-12-10", ate: "2026-12-01", motivo: "Viagem" }))).toEqual(["ate"]);
  });
});

describe("o voto (V-14)", () => {
  it("vota numa alternativa, devolve ou, na despesa, aprova ou recusa", () => {
    expect(votoSchema.parse({ escolha: "2" })).toEqual({ escolha: "2", justificativa: null });
    expect(votoSchema.parse({ escolha: "aprovar" }).escolha).toBe("APROVAR");
    expect(campos(votoSchema.safeParse({ escolha: "6" }))).toEqual(["escolha"]);
  });
  it("devolver e recusar pedem o porquê", () => {
    expect(campos(votoSchema.safeParse({ escolha: "DEVOLVER" }))).toEqual(["justificativa"]);
    expect(campos(votoSchema.safeParse({ escolha: "RECUSAR", justificativa: "ab" }))).toEqual(["justificativa"]);
    expect(votoSchema.parse({ escolha: "RECUSAR", justificativa: "Já pintamos." }).justificativa).toBe("Já pintamos.");
  });
  it("o subsíndico responde com justificativa", () => {
    expect(respostaConselhoSchema.safeParse({ aprovar: true, alternativa: 1 }).success).toBe(false);
    expect(respostaConselhoSchema.parse({ aprovar: false, justificativa: "Falta o laudo." }).alternativa).toBeNull();
  });
  it("o cartão em votação", () => {
    expect(textoVotacao({ votaram: 2, titulares: 3, necessarios: 2 })).toBe("2 de 3 votos · 2 votos decidem");
    expect(textoFaltam(["Lúcia Prado"])).toBe("Falta Lúcia");
    expect(textoFaltam(["Lúcia Prado", "Marcos Lima", "Rui Alves"])).toBe("Faltam Lúcia, Marcos e Rui");
    expect(textoFaltam([])).toBeNull();
    expect(textoEscolha("1", [{ numero: 1, descricao: "Remendo" }])).toBe("Alternativa 1: Remendo");
    expect(textoEscolha("DEVOLVER")).toBe("Devolveu sem decidir");
    expect(textoMandato("2026-01-01", "2027-12-31")).toBe("01/01/2026 a 31/12/2027");
  });
});

describe("pedir decisão ao conselho (quadro 413)", () => {
  const pedido = { versao: 5, pergunta: "Qual conserto?", prazo: "2027-03-20", alternativas: [{ descricao: "Remendo" }] };
  it("pessoa pede quem decide; o conselho, não", () => {
    expect(pedirDecisaoSchema.parse({ ...pedido, decisorId: ID }).modo).toBe("PESSOA");
    expect(pedirDecisaoSchema.parse({ ...pedido, modo: "CONSELHO" }).decisorId).toBeNull();
    expect(campos(pedirDecisaoSchema.safeParse(pedido))).toEqual(["decisorId"]);
    expect(campos(pedirDecisaoSchema.safeParse({ ...pedido, modo: "CONSELHO", decisorId: ID }))).toEqual(["decisorId"]);
  });
  it("o histórico do pedido conta o que o conselho fez", () => {
    expect(descreverEventoDecisao("pedido.decisao_pedida", { conselho: true, titulares: 3, necessarios: 2, alternativas: 2, prazo: "2026-10-30" }))
      .toBe("Decisão pedida ao conselho · 2 de 3 votos decidem · 2 alternativas · prazo 30/10/2026");
    expect(descreverEventoDecisao("pedido.decisao_respondida", { conselho: true, aprovada: true, alternativa: 1, votos: 2, titulares: 3 }))
      .toBe("Conselho aprovou a alternativa 1 (2 de 3 votos)");
    expect(descreverEventoDecisao("pedido.decisao_respondida", { conselho: true, semQuorum: true, voltou: true }))
      .toBe("Sem quórum no conselho: voltou para o síndico");
    expect(descreverEventoDecisao("pedido.decisao_respondida", { aprovada: true, alternativa: 1, porSubstituto: true }))
      .toBe("Respondida pelo subsíndico: aprovada a alternativa 1");
  });
});

describe("a despesa para aprovar (FC-10)", () => {
  const despesa = { descricao: "Bomba nova", valor: 800000, fornecedor: "HidroPress", modo: "CONSELHO", prazo: "2026-11-10" };
  it("o valor em centavos, o fornecedor e quem aprova", () => {
    expect(criarDespesaSchema.parse(despesa)).toMatchObject({ prestadorId: null, decisorId: null, vencimento: null, pedidoId: null });
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, valor: 0 }))).toEqual(["valor"]);
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, valor: 80.5 }))).toEqual(["valor"]);
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, fornecedor: null }))).toEqual(["fornecedor"]);
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, prestadorId: ID }))).toEqual(["fornecedor"]);
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, modo: "PESSOA" }))).toEqual(["decisorId"]);
    expect(campos(criarDespesaSchema.safeParse({ ...despesa, pedidoId: ID, manutencaoId: ID }))).toEqual(["ligacao"]);
    expect(alterarDespesaSchema.safeParse({ ...despesa, versao: 1 }).success).toBe(true);
  });
  it("paga fora do sistema: a data e o comprovante opcional", () => {
    expect(pagarDespesaSchema.parse({ versao: 3, pagaEm: "2026-11-03" }).comprovanteId).toBeNull();
    expect(campos(pagarDespesaSchema.safeParse({ versao: 3, pagaEm: "03/11/2026" }))).toEqual(["pagaEm"]);
  });
  it("a alçada só avisa", () => {
    expect(avisoAlcada(800000, 500000)).toBe("Passa da alçada do conselho (R$ 5.000), escrita nas Regras. É só um aviso: dá para pedir assim mesmo.");
    expect(avisoAlcada(400000, 500000)).toBeNull();
    expect(avisoAlcada(400000, null)).toBeNull();
    expect(resumoDespesa({ valor: 800000, fornecedor: { nome: "HidroPress" } })).toBe("R$ 8.000 · HidroPress");
  });
  it("o histórico em frases curtas", () => {
    expect(descreverEventoAprovacao("despesa.pedida", { modo: "CONSELHO", titulares: 3, necessarios: 2 })).toBe("Pedida ao conselho · 2 de 3 votos aprovam");
    expect(descreverEventoAprovacao("despesa.paga_fora", { pagaEm: "2026-11-03" })).toBe("Paga fora do sistema em 03/11/2026");
    expect(descreverEventoAprovacao("conselho.voto", { antes: "1" })).toBe("Voto trocado");
    expect(descreverEventoAprovacao("outra.coisa", {})).toBeNull();
  });
});

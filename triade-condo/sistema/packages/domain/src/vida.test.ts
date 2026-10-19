import { describe, expect, it } from "vitest";
import {
  centavosDoTexto, filtroDoAnuncio, publicarAnuncioSchema, recusarAnuncioSchema, tirarAnuncioSchema,
  avisoQuorum, descreverEventoAssembleia, fracoesSchema, porcento, salvarAssembleiaSchema,
  areaSchema,
  criarEnqueteSchema,
  descreverEventoEnquete,
  porcentagem,
  textoRespostas,
  descreverArea,
  descreverEventoReserva,
  duracaoBloco,
  filtroReservasSchema,
  horaCurta,
  motivoReservaSchema,
  reais,
  registrarReservaSchema,
  textoLimite,
} from "./vida.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const SALAO = {
  nome: "Salão de festas", reserva: "SINDICO", antecedenciaMin: 2, antecedenciaMax: 60, horaInicio: "10:00", horaFim: "23:00",
  modo: "PERIODO", capacidade: 80, limiteQuantidade: 1, limitePeriodo: "MES",
} as const;

describe("vida em condomínio (peça R12)", () => {
  it("AC-07: a área tem horário, antecedência, blocos e limite coerentes", () => {
    expect(areaSchema.parse(SALAO).cancelarSemAvisoDias).toBe(3);
    expect(areaSchema.safeParse({ ...SALAO, horaFim: "09:00" }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, horaFim: "24:00" }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, antecedenciaMin: 70 }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS" }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS", blocoMinutos: 45 }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS", blocoMinutos: 60 }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, limitePeriodo: null }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, limiteQuantidade: null, limitePeriodo: null, toleranciaDias: 7 }).success).toBe(false);
  });

  it("AC-01: área ativa precisa de alguém que possa reservar", () => {
    const ninguem = { podeProprietarioMorador: false, podeInquilino: false, podeProprietarioAusente: false };
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: true }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: false }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: true, reserva: "SEM_RESERVA" }).success).toBe(true);
  });

  it("AC-07: a linha da área diz as regras como no desenho", () => {
    expect(descreverArea(SALAO)).toBe("Síndico aprova · 2 a 60 dias de antecedência · 10h às 23h · até 80 pessoas · 1 por mês por unidade");
    expect(descreverArea({ ...SALAO, reserva: "AUTOMATICA", antecedenciaMin: 0, antecedenciaMax: 7, modo: "BLOCOS", blocoMinutos: 120,
      capacidade: 12, limiteQuantidade: null, limitePeriodo: null, criadaPeloSindico: true }))
      .toBe("Criada pelo síndico · Automática · até 7 dias · blocos de 2 horas, 10h às 23h · até 12 pessoas");
    expect(descreverArea({ ...SALAO, reserva: "AUTOMATICA", limiteQuantidade: 2, toleranciaDias: 7 })).toContain("2 por mês por unidade, +1 se sobrar");
    expect(descreverArea({ ...SALAO, reserva: "SEM_RESERVA", horaInicio: "06:00" })).toBe("Uso livre, sem reserva · 6h às 23h");
  });

  it("AC-06: a conta do limite na reserva", () => {
    expect(textoLimite({ n: 2, quantidade: 2, periodo: "MES" }, "2026-10-26", false)).toBe("2ª reserva da unidade em outubro (limite 2)");
    expect(textoLimite({ n: 3, quantidade: 2, periodo: "MES" }, "2026-11-01", true)).toMatch(/^3ª em novembro, aceita/);
  });

  it("registrar, recusar e listar", () => {
    expect(registrarReservaSchema.parse({ areaId: U, unidadeId: U, data: "2026-10-25" }).contatoId).toBeNull();
    expect(registrarReservaSchema.safeParse({ areaId: U, unidadeId: U, data: "25/10" }).success).toBe(false);
    expect(motivoReservaSchema.safeParse({ versao: 1, motivo: "  " }).success).toBe(false);
    expect(filtroReservasSchema.parse({}).filtro).toBe("A_APROVAR");
  });

  it("textos", () => {
    expect(horaCurta("08:30")).toBe("8h30");
    expect(horaCurta("24:00")).toBe("24h");
    expect(duracaoBloco(60)).toBe("1 hora");
    expect(duracaoBloco(90)).toBe("1h30");
    expect(reais(15000)).toBe("R$ 150,00");
    expect(descreverEventoReserva("estado.mudou", { para: "CONFIRMADA" })).toBe("Confirmada na hora");
    expect(descreverEventoReserva("estado.mudou", { de: "A_APROVAR", para: "CONFIRMADA" })).toBe("Aprovada");
    expect(descreverEventoReserva("estado.mudou", { para: "CANCELADA", evento: "CANCELADA_PELO_MORADOR" })).toBe("Cancelada pelo morador");
  });
});

describe("enquetes (AC-03)", () => {
  const base = { pergunta: "Qual cor para a fachada?", opcoes: ["Cinza", "Areia"], por: "UNIDADE", secreta: true,
    abertaAte: "2026-10-31T23:59:00-03:00", canais: ["WHATSAPP"] };
  it("limpa as opções vazias e pede pelo menos duas, diferentes", () => {
    expect(criarEnqueteSchema.parse({ ...base, opcoes: [" Cinza ", "", "Areia"] }).opcoes).toEqual(["Cinza", "Areia"]);
    expect(criarEnqueteSchema.safeParse({ ...base, opcoes: ["Cinza", ""] }).success).toBe(false);
    expect(criarEnqueteSchema.safeParse({ ...base, opcoes: ["Cinza", "cinza"] }).success).toBe(false);
    expect(criarEnqueteSchema.safeParse({ ...base, opcoes: ["1", "2", "3", "4", "5", "6", "7"] }).success).toBe(false);
  });
  it("pede o prazo com fuso e ao menos um canal", () => {
    expect(criarEnqueteSchema.safeParse({ ...base, abertaAte: "2026-10-31" }).success).toBe(false);
    expect(criarEnqueteSchema.safeParse({ ...base, canais: [] }).success).toBe(false);
    expect(criarEnqueteSchema.parse({ ...base, canais: ["MURAL", "MURAL"] }).canais).toEqual(["MURAL"]);
  });
  it("conta as respostas e a porcentagem", () => {
    expect(textoRespostas(0, 12)).toBe("Ninguém respondeu ainda, de 12");
    expect(textoRespostas(1, 12)).toBe("1 de 12 respondeu");
    expect(textoRespostas(7, 12)).toBe("7 de 12 responderam");
    expect([porcentagem(1, 3), porcentagem(0, 0)]).toEqual([33, 0]);
  });
  it("descreve o histórico", () => {
    expect(descreverEventoEnquete("enquete.criada", { convites: 12 })).toBe("Enviada para 12 convites");
    expect(descreverEventoEnquete("enquete.encerrada", { pelo: "PRAZO" })).toBe("Fechou no prazo");
    expect(descreverEventoEnquete("enquete.link_gerado", { para: "Torre A · 201" })).toBe("Link copiado para Torre A · 201");
  });
});

describe("assembleias (AC-02)", () => {
  const base = { titulo: "AGO de março", tipo: "ORDINARIA", forma: "HIBRIDA", primeiraChamada: "2027-03-20T19:00:00-03:00",
    segundaChamada: "2027-03-20T19:30:00-03:00", itens: [{ titulo: "Contas de 2026", tipo: "APROVACAO", quorum: "MAIORIA_PRESENTES" }] };
  it("pede a pauta, as chamadas com fuso e os valores conhecidos", () => {
    expect(salvarAssembleiaSchema.parse(base).versao).toBeNull();
    expect(salvarAssembleiaSchema.safeParse({ ...base, itens: [] }).success).toBe(false);
    expect(salvarAssembleiaSchema.safeParse({ ...base, primeiraChamada: "2027-03-20" }).success).toBe(false);
    expect(salvarAssembleiaSchema.safeParse({ ...base, itens: [{ ...base.itens[0], quorum: "TUDO" }] }).success).toBe(false);
  });
  it("aceita fração vazia, mas não fora de 0 a 100", () => {
    const u = "8f9a0b1c-2d3e-4f4a-9b5c-000000000001";
    expect(fracoesSchema.safeParse({ fracoes: [{ unidadeId: u, fracao: null, versao: 1 }] }).success).toBe(true);
    expect(fracoesSchema.safeParse({ fracoes: [{ unidadeId: u, fracao: 0, versao: 1 }] }).success).toBe(false);
    expect(fracoesSchema.safeParse({ fracoes: [{ unidadeId: u, fracao: 100.5, versao: 1 }] }).success).toBe(false);
  });
  it("avisa quando o quórum não é alcançável e escreve a porcentagem", () => {
    expect(avisoQuorum("MAIORIA_PRESENTES", false)).toBeNull();
    expect(avisoQuorum("DOIS_TERCOS_TODAS", true)).toBeNull();
    expect(avisoQuorum("DOIS_TERCOS_TODAS", false)).toBe("Os presentes não alcançam dois terços de todas as frações: mesmo com todos a favor, o item não passa.");
    expect([porcento(62.5), porcento(100), porcento(33.333)]).toEqual(["62,5%", "100%", "33,3%"]);
  });
  it("descreve o histórico", () => {
    expect(descreverEventoAssembleia("assembleia.convocada", { unidades: 48 })).toBe("Convocada: edital publicado e 48 unidades convidadas");
    expect(descreverEventoAssembleia("assembleia.item_encerrado", { item: 2, situacao: "ESCOLHIDA", vencedor: "Rui" })).toBe("Item 2 votado: escolhida Rui");
    expect(descreverEventoAssembleia("assembleia.procuracao_recusada", { unidade: "Torre A · 201", motivo: "Sem firma" }))
      .toBe("Procuração de Torre A · 201 recusada: Sem firma");
  });
});

describe("classificados (AC-05)", () => {
  it("separa os anúncios pelos filtros da aba", () => {
    expect(["A_APROVAR", "NO_MURAL", "RECUSADO", "RETIRADO", "VENCIDO"].map((e) => filtroDoAnuncio(e as never)))
      .toEqual(["A_APROVAR", "NO_MURAL", "ENCERRADOS", "ENCERRADOS", "ENCERRADOS"]);
  });
  it("lê o valor escrito em reais", () => {
    expect([centavosDoTexto("R$ 900"), centavosDoTexto("1.150,50"), centavosDoTexto(" "), centavosDoTexto("9,999"), centavosDoTexto("abc")])
      .toEqual([90000, 115050, null, undefined, undefined]);
  });
  it("publicar pede título; recusar pede motivo; tirar não", () => {
    expect(publicarAnuncioSchema.safeParse({ versao: 1, titulo: "ab" }).success).toBe(false);
    expect(publicarAnuncioSchema.parse({ versao: 1, titulo: " Vendo bicicleta " })).toEqual({ versao: 1, titulo: "Vendo bicicleta", valorCentavos: null });
    expect(recusarAnuncioSchema.safeParse({ versao: 1, motivo: "" }).success).toBe(false);
    expect(tirarAnuncioSchema.parse({ versao: 2, motivo: "  " })).toEqual({ versao: 2, motivo: null });
  });
});

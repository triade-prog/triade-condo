// Renovações nas telas (R17.7; CM-30, CM-31 e CM-32): o valor de hoje e com reajuste (com o índice a
// definir), o selo do aviso, os sinais em texto, o pedido de cancelamento (347), as abas pelo
// endereço e as linhas do cartão do Início (335).
import { describe, expect, it } from "vitest";
import { TEXTO_INDICE_A_DEFINIR } from "@triade/domain";
import { detalheInicio, linkInicio, seloInicio, type ItemInicioComercial } from "./painel.ts";
import {
  abaDoEndereco, avisoSugerido, clientesAtivos, contagemAba, detalheCancelamento, detalheExpansao, detalheRenovacao, mesesRenovacoes, podeAvisar, seloAviso,
  textoComReajuste, textoPedidoPor, textoPlanoCancelamento, textoRegra, textoSeConfirmar, textoSinal, textoUltimoDia, textoValeDesde, textoValorHoje,
  type Cancelamento, type ClienteRenovacao, type Expansao, type RegraReajusteTela, type Renovacao,
} from "./renovacoes.ts";

const regra = (r: Partial<RegraReajusteTela> = {}): RegraReajusteTela => ({ indice: "IPCA", percentual: 4.8, prazoAvisoDias: 30, definida: true, versao: 2, ...r });
const ren = (r: Partial<Renovacao> = {}): Renovacao => ({
  interessadoId: "i1", condominio: "Residencial Pequi", contrato: 3, aniversario: "2026-11-24", avisarAte: "2026-10-25", tipo: "REAJUSTE", situacao: "AVISAR",
  hoje: { valor: 22900, ciclo: "MENSAL", tabela: "CHEIA" }, novo: { valor: 23999, indice: "IPCA", percentual: 4.8 }, ...r,
});
const cliente: ClienteRenovacao = {
  id: "i1", condominio: "Residencial Pequi", contato: "Marta", situacao: "ATIVO",
  plano: { valor: 22900, ciclo: "MENSAL", tabela: "CHEIA", diaVencimento: 10, inicio: "2025-12-01" },
};
const pedido = (k: Partial<Cancelamento> = {}): Cancelamento => ({
  id: "k1", versao: 1, interessadoId: "i2", condominio: "Edifício Ipiranga", plano: { valor: 12900, ciclo: "MENSAL", inicio: "2025-12-01", tabela: "FUNDADOR" },
  pedidoPor: "Ana Ribeiro, síndica eleita em 15/10", pedidoEm: "2026-10-24T14:20:00Z", avisoDias: 30, ultimoDia: "2026-11-23", situacao: "PEDIDO", ...k,
});

describe("reajuste e renovação (CM-30, quadro 346)", () => {
  it("o valor de hoje e com reajuste, como no desenho", () => {
    expect(textoValorHoje(ren())).toBe("R$ 229,00");
    expect(textoComReajuste(ren())).toBe("R$ 239,99 · IPCA 4,8%");
    const fundador = ren({ tipo: "FIM_FUNDADOR", hoje: { valor: 12900, ciclo: "MENSAL", tabela: "FUNDADOR" }, novo: { valor: 19900, tabela: "CHEIA" } });
    expect(textoValorHoje(fundador)).toBe("R$ 129,00 · fundador");
    expect(textoComReajuste(fundador)).toBe("R$ 199,00 · fim do fundador");
  });

  it("sem índice, não calcula e mostra o índice a definir; sem plano, avisa", () => {
    expect(textoComReajuste(ren({ novo: undefined }))).toBe(TEXTO_INDICE_A_DEFINIR);
    expect(textoComReajuste(ren({ novo: undefined, semPlano: true, hoje: undefined }))).toBe("Sem plano: nada a calcular");
    expect(textoValorHoje(ren({ hoje: undefined }))).toBe("Sem plano");
    expect(podeAvisar(ren({ novo: undefined }))).toBe(false);
    expect(podeAvisar(ren())).toBe(true);
    expect(podeAvisar(ren({ id: "r1", situacao: "AVISO_ENVIADO" }))).toBe(false);
    expect(textoRegra(regra({ definida: false, indice: undefined, percentual: undefined }))).toBe(`Índice ${TEXTO_INDICE_A_DEFINIR} · aviso 30 dias antes do aniversário`);
    expect(textoRegra(regra({ referencia: "12 meses até setembro" }))).toBe("IPCA 4,8% (12 meses até setembro) · aviso 30 dias antes do aniversário");
  });

  it("o selo do aviso: perto em atenção, longe neutro, atrasado em erro, enviado em ok", () => {
    expect(seloAviso(ren(), "2026-10-20")).toEqual({ texto: "Avisar até 25/10", tom: "atencao" });
    expect(seloAviso(ren({ avisarAte: "2026-11-10" }), "2026-10-20")).toEqual({ texto: "Avisar até 10/11", tom: "neutro" });
    expect(seloAviso(ren({ situacao: "ATRASADO" }), "2026-10-26")).toEqual({ texto: "Aviso atrasado: era até 25/10", tom: "erro" });
    expect(seloAviso(ren({ id: "r1", situacao: "AVISO_ENVIADO" }), "2026-10-26")).toEqual({ texto: "Aviso enviado", tom: "ok" });
    expect(seloAviso(ren({ id: "r1", situacao: "APLICADO", valeDesde: "2026-12-01" }), "2026-12-02").texto).toBe("Valor novo desde 12/2026");
  });

  it("o aviso sugerido e desde quando vale", () => {
    const t = avisoSugerido(ren(), regra(), cliente, "2026-10-20")!;
    expect(t).toContain("Olá, Marta.");
    expect(t).toContain("de R$ 229,00 para R$ 239,99 por mês, a partir da competência 12/2026");
    // O aniversário (24/11) e o fim do prazo do aviso passam do vencimento de novembro (dia 10): vale a
    // de dezembro enquanto o fim do prazo cair até 10/12; depois, a de janeiro.
    expect(textoValeDesde(ren(), regra(), cliente, "2026-10-30")).toContain("competência 12/2026");
    expect(textoValeDesde(ren(), regra(), cliente, "2026-11-10")).toContain("competência 12/2026");
    expect(textoValeDesde(ren(), regra(), cliente, "2026-11-20")).toContain("competência 01/2027");
    expect(avisoSugerido(ren({ novo: undefined }), regra(), cliente, "2026-10-20")).toBeNull();
    const reg = ren({ id: "r1", situacao: "AVISO_ENVIADO", aviso: { em: "2026-10-20", canal: "WHATSAPP" }, valeDesde: "2026-12-01",
      aditivo: { id: "a1", numero: 1, situacao: "PRONTO", hash: "a" } });
    expect(detalheRenovacao(reg)).toBe("Aviso em 20/10/2026 · vale desde a competência 12/2026 · aditivo nº 1");
    expect(detalheRenovacao(ren({ id: "r2", situacao: "DISPENSADO", dispensaMotivo: "Combinado na proposta" }))).toBe("Sem reajuste: Combinado na proposta");
  });

  it("os meses do seletor olham para a frente", () => {
    const m = mesesRenovacoes("2026-11");
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ valor: "2026-11", texto: "Novembro de 2026" });
    expect(m[11]!.valor).toBe("2027-10");
  });
});

describe("risco, expansão e cancelamento (CM-31, CM-32, quadro 347)", () => {
  it("os sinais em texto", () => {
    expect(textoSinal({ tipo: "SINDICO_NOVO", data: "2026-10-15", origem: "A_MAO" })).toBe("Síndico novo eleito 15/10");
    expect(textoSinal({ tipo: "SINDICO_NOVO", data: "2026-10-15", origem: "TROCA_SINDICO" })).toBe("Síndico novo desde 15/10");
    expect(textoSinal({ tipo: "USO_CAINDO", data: "2026-10-01", origem: "PEDIDOS", detalhe: "Uso caiu 40% em 30 dias" })).toBe("Uso caiu 40% em 30 dias");
    expect(textoSinal({ tipo: "TROCA_NA_PAUTA", data: "2026-11-12", origem: "A_MAO" })).toBe("Troca de sistema na pauta de 12/11");
  });

  it("a expansão: etapa, quem atende e o próximo passo; a encerrada, o resultado", () => {
    const e: Expansao = {
      id: "e1", versao: 1, interessadoId: "i1", nome: "Marta Lins", condominio: "Residencial Pequi", tipo: "MAIS_UM_PREDIO", etapa: "EM_CONVERSA", motivo: "Tem outro prédio",
      responsavel: { id: "u1", nome: "Bianca" }, proximoPasso: "Ligar", proximoPassoData: "2026-11-03", criadoEm: "2026-10-20T12:00:00Z",
    };
    expect(detalheExpansao(e)).toBe("Em conversa · Bianca · Ligar em 03/11");
    expect(detalheExpansao({ ...e, etapa: "PERDIDA", encerradaEm: "2026-10-25T12:00:00Z", resultado: "Fechou com outro" })).toBe("Perdida: Fechou com outro");
  });

  it("o pedido de cancelamento como na janela 347", () => {
    expect(textoPlanoCancelamento(pedido())).toBe("Edifício Ipiranga · desde 12/2025 · R$ 129,00 por mês");
    expect(textoPedidoPor(pedido())).toBe("Ana Ribeiro, síndica eleita em 15/10 · 24/10 11:20");
    expect(textoUltimoDia(pedido())).toBe("30 dias: último dia 23/11/2026, sem multa (N.1)");
    expect(textoSeConfirmar(pedido())).toContain("o acesso continua até 23/11");
    expect(detalheCancelamento(pedido({ motivo: "PRECO" }))).toBe("Pedido em 24/10/2026 · Preço · último dia 23/11/2026");
    expect(detalheCancelamento(pedido({ situacao: "CONFIRMADO", motivo: "PRECO", exportacaoPedida: false }))).toContain("sem síndico ativo para a exportação");
    expect(detalheCancelamento(pedido({ situacao: "ENCERRADO" }))).toContain("saiu em 23/11/2026");
    expect(textoPedidoPor(pedido({ pedidoPor: undefined }))).toContain("Dado apagado (LGPD)");
  });

  it("as abas pelo endereço, a contagem do banco e os clientes que podem pedir", () => {
    expect(abaDoEndereco("risco")).toBe("RISCO");
    expect(abaDoEndereco("cancelamentos")).toBe("CANCELAMENTOS");
    expect(abaDoEndereco("outra")).toBe("REAJUSTE");
    expect(contagemAba({ contagens: { renovacoes: 3, riscos: 2, expansoes: 3, cancelamentos: 1 } }, "EXPANSAO")).toBe(3);
    expect(clientesAtivos([cliente, { ...cliente, id: "i2", situacao: "CANCELANDO" }, { ...cliente, id: "i3", situacao: "ENCERRADO" }]).map((c) => c.id)).toEqual(["i1"]);
  });
});

describe("o cartão do Comercial no Início (quadro 335)", () => {
  const item = (i: Partial<ItemInicioComercial>): ItemInicioComercial => ({
    id: "i1", condominio: "Residencial Pequi", etapa: "GANHO", motivo: "RENOVACAO", meu: false, outros: 0,
    renovacao: { aniversario: "2026-11-24", avisarAte: "2026-10-25", dias: 30 }, ...i,
  });

  it("a renovação: 'Cliente · reajuste em 30 dias' e o selo 'Avisar o síndico'", () => {
    expect(detalheInicio(item({}))).toBe("Cliente · reajuste em 30 dias");
    expect(seloInicio(item({}), "2026-10-20")).toEqual({ texto: "Avisar o síndico", tom: "atencao" });
    expect(seloInicio(item({}), "2026-10-26")).toEqual({ texto: "Aviso atrasado", tom: "erro" });
    expect(linkInicio(item({}))).toBe("/comercial/renovacoes");
    expect(detalheInicio(item({ renovacao: { aniversario: "2026-10-20", avisarAte: "2026-09-20", dias: -6 }, outros: 1 }))).toBe("Cliente · aniversário há 6 dias · mais 1 aviso");
  });

  it("o risco leva à aba Risco", () => {
    const r = item({ motivo: "RISCO", renovacao: undefined, risco: { tipo: "SINDICO_NOVO", data: "2026-10-15" } });
    expect(seloInicio(r)).toEqual({ texto: "Síndico novo", tom: "atencao" });
    expect(detalheInicio(r)).toBe("Cliente · sinal de 15/10");
    expect(linkInicio(r)).toBe("/comercial/renovacoes?aba=risco");
    expect(linkInicio(item({ motivo: "PARADO", renovacao: undefined, etapa: "PROPOSTA_ENVIADA" }))).toBe("/comercial/i1");
  });
});

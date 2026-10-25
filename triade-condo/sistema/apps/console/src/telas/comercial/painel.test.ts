// Painel comercial, janelas e o cartão do Início nas telas (R17.5; CM-10, CM-18, CM-04): os textos
// saem dos números do banco, o seletor de meses chega ao próximo para a meta, a janela diz de quando
// a quando avisa e o Início nunca mostra a pessoa de contato.
import { describe, expect, it } from "vitest";
import {
  apoioPrimeiroRetorno, barrasFunil, detalheInicio, duracaoUtil, mesesDoSeletor, seloInicio, seloJanela, somarMeses, textoJanela, textoMes, textoMeta,
  textoPrimeiroRetorno, textoPromessas, textoVence, type ItemInicioComercial, type JanelaCondominio,
} from "./painel.ts";

const janela = (j: Partial<JanelaCondominio>): JanelaCondominio => ({
  tipo: "ASSEMBLEIA", data: "2026-11-28", de: "2026-09-29", ate: "2026-10-29", situacao: "ABERTA", tratada: false, pedeAtencao: true, ...j,
});
const item = (i: Partial<ItemInicioComercial>): ItemInicioComercial => ({
  id: "a", condominio: "Edifício Jatobá", etapa: "NOVO", motivo: "PRIMEIRO_RETORNO", meu: false, outros: 0, ...i,
});

describe("painel comercial (0309)", () => {
  it("o mês em texto e as contas de mês", () => {
    expect(textoMes("2026-10")).toBe("outubro de 2026");
    expect(textoMes("2026-03", true)).toBe("Março de 2026");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
  });

  it("o seletor traz o próximo mês, para a meta, e os 12 até o atual", () => {
    const m = mesesDoSeletor("2026-10");
    expect(m[0]).toEqual({ valor: "2026-11", texto: "Novembro de 2026 (próximo)" });
    expect(m[1]?.valor).toBe("2026-10");
    expect(m.at(-1)?.valor).toBe("2025-11");
    expect(m).toHaveLength(13);
  });

  it("a meta: percentual do novo MRR, herdada ou sem meta", () => {
    const ganhos = { quantos: 3, novoMrr: 68700, semValor: 0 };
    expect(textoMeta({ ganhos, meta: { mes: "2026-10", herdada: false, total: 100000, porPessoa: [], alteradoEm: "" } })).toBe("meta R$ 1.000,00 · 69%");
    expect(textoMeta({ ganhos, meta: { mes: "2026-09", herdada: true, total: 100000, porPessoa: [], alteradoEm: "" } })).toBe("meta R$ 1.000,00 · 69% (a do mês anterior)");
    expect(textoMeta({ ganhos })).toBe("sem meta para o mês");
  });

  it("primeiro retorno: 10 de 14, com a mediana em horas úteis; sem novos, traço", () => {
    const r = { total: 14, noPrazo: 10, foraDoPrazo: 4, aguardando: 1, medianaMinutosUteis: 150,
      cotacoes: { total: 0, noPrazo: 0, aguardando: 0 }, site: { total: 8, noPrazo: 8, aguardando: 0 } };
    expect(textoPrimeiroRetorno(r)).toBe("10 de 14");
    expect(apoioPrimeiroRetorno(r)).toBe("meta interna (K.1), sem as cotações · 1 aguarda no prazo · mediana 2 h 30 min");
    expect(apoioPrimeiroRetorno({ ...r, aguardando: 2 })).toContain("2 aguardam no prazo");
    expect(textoPrimeiroRetorno({ ...r, total: 0 })).toBe("—");
    expect(textoPromessas(r)).toBe("Site: 8 de 8 respondidos até o fim do próximo dia útil (a promessa do site).");
    expect(textoPromessas({ ...r, site: { total: 0, noPrazo: 0, aguardando: 1 }, cotacoes: { total: 3, noPrazo: 2, aguardando: 2 } })).toBe(
      "Site: 0 de 0 respondidos até o fim do próximo dia útil (a promessa do site), 1 aguarda no prazo. Cotações: 2 de 3 respondidas em 24 horas, 2 aguardam no prazo.");
    expect(textoPromessas({ ...r, site: { total: 0, noPrazo: 0, aguardando: 0 } })).toBe("Site: nenhum pedido no mês.");
    expect(duracaoUtil(45)).toBe("45 min");
    expect(duracaoUtil(180)).toBe("3 h");
  });

  it("o funil em percentual dos novos; sem novos, zero", () => {
    const funil = [{ etapa: "NOVO" as const, chegaram: 14 }, { etapa: "EM_CONTATO" as const, chegaram: 11 }, { etapa: "GANHO" as const, chegaram: 3 }];
    expect(barrasFunil({ funil, novos: 14 }).map((b) => `${b.texto} ${b.n} · ${b.pct}%`)).toEqual(["Novo 14 · 100%", "Em contato 11 · 79%", "Ganho 3 · 21%"]);
    expect(barrasFunil({ funil: funil.map((f) => ({ ...f, chegaram: 0 })), novos: 0 }).every((b) => b.pct === 0)).toBe(true);
  });

  it("propostas vencendo: hoje, amanhã ou o dia", () => {
    expect(textoVence("2026-10-20", "2026-10-20")).toBe("Vence hoje");
    expect(textoVence("2026-10-21", "2026-10-20")).toBe("Vence amanhã");
    expect(textoVence("2026-10-31", "2026-10-30")).toBe("Vence amanhã");
    expect(textoVence("2026-11-05", "2026-10-30")).toBe("Vence 05/11");
  });
});

describe("janelas do condomínio (CM-18)", () => {
  it("cada janela diz a data e de quando a quando avisa", () => {
    expect(textoJanela(janela({}))).toBe("Assembleia ordinária em 28/11/2026 · aviso de 29/09 a 29/10");
    expect(textoJanela(janela({ tipo: "MANDATO", data: "2027-01-12", de: "2026-11-13", ate: "2027-01-12", situacao: "PROXIMA" })))
      .toBe("Fim do mandato do síndico até 12/01/2027 · aviso de 13/11 a 12/01");
    expect(textoJanela(janela({ tipo: "FIDELIDADE", data: "2026-10-09", situacao: "PASSOU" }))).toBe("Fim da fidelidade do sistema atual até 09/10/2026 · a janela passou");
    expect(textoJanela(janela({ tipo: "RETOMAR", data: "2026-10-13", ate: undefined }))).toBe("Voltar a falar desde 13/10/2026");
    expect(textoJanela(janela({ tipo: "SINDICO_NOVO", data: "2026-10-10", ate: undefined }))).toBe("Síndico novo desde 10/10/2026");
  });

  it("o selo: pede atenção, já visto, abre em ou passou", () => {
    expect(seloJanela(janela({}))).toEqual({ texto: "Pede atenção", tom: "atencao" });
    expect(seloJanela(janela({ tratada: true, pedeAtencao: false }))).toEqual({ texto: "Já visto", tom: "ok" });
    expect(seloJanela(janela({ situacao: "PROXIMA", de: "2026-11-13" })).texto).toBe("Abre em 13/11");
    expect(seloJanela(janela({ situacao: "PASSOU" })).texto).toBe("Passou");
  });
});

describe("cartão Comercial no Início", () => {
  it("o selo de cada motivo, como no quadro 335", () => {
    expect(seloInicio(item({}))).toEqual({ texto: "Primeiro retorno: meta passou", tom: "erro" });
    expect(seloInicio(item({ motivo: "PARADO", diasParado: 6 })).texto).toBe("Parado · 6 dias");
    expect(seloInicio(item({ motivo: "JANELA", janela: janela({}) })).texto).toBe("Assembleia 28/11");
    expect(seloInicio(item({ motivo: "JANELA", janela: janela({ tipo: "SINDICO_NOVO" }) })).texto).toBe("Síndico novo");
  });

  it("a linha de baixo: etapa, de quem é e os outros avisos; nunca a pessoa de contato", () => {
    expect(detalheInicio(item({}))).toBe("Novo · sem responsável");
    expect(detalheInicio(item({ etapa: "EM_CONTATO", responsavel: { id: "b", nome: "Bianca" } }))).toBe("Em contato · Bianca");
    expect(detalheInicio(item({ meu: true, responsavel: { id: "b", nome: "Bianca" }, outros: 2 }))).toBe("Novo · com você · mais 2 avisos");
  });
});

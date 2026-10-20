// Pedidos relacionados (AT-18), decisões do síndico (AT-23) e os indicadores da F7.4 (TR-01).
import { describe, expect, it } from "vitest";
import {
  descreverEventoDecisao,
  desfazerLigacaoSchema,
  filtroDecisoesSchema,
  mostrarCusto,
  resumoAlternativas,
  ligarPedidosSchema,
  parecidosSchema,
  pedirDecisaoSchema,
  prazoDaDecisao,
  responderDecisaoSchema,
  retirarDecisaoSchema,
  rotuloLigacao,
} from "./decisoes.ts";
import { descreverEvento } from "./eventos.ts";
import { descreverEventoPedido } from "./pedidos.ts";

const ID = "6f2c7c1e-2a5b-4c1d-9e3f-0a1b2c3d4e5f";

describe("ligar pedidos (AT-18)", () => {
  it("liga como reincidência ou duplicado, com motivo de 3 a 300 caracteres", () => {
    expect(ligarPedidosSchema.parse({ versao: 2, outroId: ID, tipo: "REINCIDENCIA", motivo: " voltou a pingar " })).toMatchObject({
      motivo: "voltou a pingar",
      encerrar: false,
      texto: null,
      versaoOutro: null,
    });
    expect(ligarPedidosSchema.safeParse({ versao: 2, outroId: ID, tipo: "PARECIDO", motivo: "abc" }).success).toBe(false);
    expect(ligarPedidosSchema.safeParse({ versao: 2, outroId: ID, tipo: "DUPLICADO", motivo: "ab" }).success).toBe(false);
    expect(ligarPedidosSchema.safeParse({ versao: 2, outroId: ID, tipo: "DUPLICADO", motivo: "x".repeat(301) }).success).toBe(false);
  });
  it("encerrar só vale para o duplicado e pede o texto ao morador", () => {
    const base = { versao: 2, outroId: ID, motivo: "mesma lâmpada", encerrar: true };
    const sem = ligarPedidosSchema.safeParse({ ...base, tipo: "DUPLICADO" });
    expect(sem.success).toBe(false);
    expect(sem.error?.issues.map((i) => i.path[0])).toEqual(["texto"]);
    const reinc = ligarPedidosSchema.safeParse({ ...base, tipo: "REINCIDENCIA", texto: "Já estamos cuidando no outro pedido." });
    expect(reinc.error?.issues.map((i) => i.path[0])).toEqual(["encerrar"]);
    expect(ligarPedidosSchema.parse({ ...base, tipo: "DUPLICADO", texto: "Já estamos cuidando no outro pedido.", versaoOutro: 4 })).toMatchObject({
      encerrar: true,
      versaoOutro: 4,
    });
  });
  it("desfazer pede motivo; descartar parecido pede o outro pedido", () => {
    expect(desfazerLigacaoSchema.safeParse({ versao: 3, motivo: "ab" }).success).toBe(false);
    expect(desfazerLigacaoSchema.parse({ versao: 3, motivo: " liguei errado " }).motivo).toBe("liguei errado");
  });
  it("cada lado da ligação tem o seu rótulo", () => {
    expect(rotuloLigacao("REINCIDENCIA", "NOVO")).toBe("Reincidência de");
    expect(rotuloLigacao("REINCIDENCIA", "ANTIGO")).toBe("Voltou em");
    expect(rotuloLigacao("DUPLICADO", "NOVO")).toBe("Duplicado de");
    expect(rotuloLigacao("DUPLICADO", "ANTIGO")).toBe("Relatado de novo em");
  });
  it("a janela dos parecidos é 30, 60, 90 ou 180 dias", () => {
    expect(parecidosSchema.parse({ versao: 1, dias: 60 }).dias).toBe(60);
    expect(parecidosSchema.safeParse({ versao: 1, dias: 45 }).success).toBe(false);
  });
});

describe("pedir decisão ao síndico (AT-23)", () => {
  const pedido = {
    versao: 5,
    pergunta: "Qual orçamento aprovamos para o portão?",
    prazo: "2027-03-20",
    decisorId: ID,
    alternativas: [{ descricao: "Trocar o motor", detalhe: "Portões Rio", custo: 480000 }, { descricao: "Consertar" }],
  };
  it("leva de 1 a 5 alternativas, com custo em centavos", () => {
    const d = pedirDecisaoSchema.parse(pedido);
    expect(d.porque).toBeNull();
    expect(d.alternativas[1]).toEqual({ descricao: "Consertar", detalhe: null, custo: null });
    expect(pedirDecisaoSchema.safeParse({ ...pedido, alternativas: [] }).success).toBe(false);
    expect(pedirDecisaoSchema.safeParse({ ...pedido, alternativas: Array(6).fill({ descricao: "Opção" }) }).success).toBe(false);
    expect(pedirDecisaoSchema.safeParse({ ...pedido, alternativas: [{ descricao: "Opção", custo: 10.5 }] }).success).toBe(false);
    expect(pedirDecisaoSchema.safeParse({ ...pedido, alternativas: [{ descricao: "Opção", custo: -1 }] }).success).toBe(false);
  });
  it("pede pergunta, prazo como data e o porquê com pelo menos 3 caracteres quando vem", () => {
    expect(pedirDecisaoSchema.safeParse({ ...pedido, pergunta: "ab" }).success).toBe(false);
    expect(pedirDecisaoSchema.safeParse({ ...pedido, prazo: "20/03/2027" }).success).toBe(false);
    expect(pedirDecisaoSchema.safeParse({ ...pedido, porque: "ab" }).success).toBe(false);
    expect(pedirDecisaoSchema.parse({ ...pedido, porque: " " }).porque).toBeNull();
  });
  it("aprovar pede a alternativa; devolver não; os dois pedem justificativa", () => {
    expect(responderDecisaoSchema.safeParse({ versao: 1, aprovar: true, justificativa: "Mais barato" }).success).toBe(false);
    expect(responderDecisaoSchema.parse({ versao: 1, aprovar: true, alternativa: 2, justificativa: "Mais barato" }).alternativa).toBe(2);
    expect(responderDecisaoSchema.parse({ versao: 1, aprovar: false, justificativa: "Falta orçamento" }).alternativa).toBeNull();
    expect(responderDecisaoSchema.safeParse({ versao: 1, aprovar: false, justificativa: "ok" }).success).toBe(false);
    expect(retirarDecisaoSchema.safeParse({ versao: 1, motivo: "" }).success).toBe(false);
  });
  it("a lista abre nas que aguardam", () => {
    expect(filtroDecisoesSchema.parse({}).filtro).toBe("AGUARDANDO");
    expect(filtroDecisoesSchema.safeParse({ filtro: "VENCIDAS" }).success).toBe(false);
  });
});

describe("histórico e textos", () => {
  it("o histórico do pedido conta a ligação e a decisão em frase curta", () => {
    expect(descreverEventoPedido("pedido.ligado", { tipo: "REINCIDENCIA", papel: "NOVO", protocolo: "2027-0001" })).toBe("Reincidência de 2027-0001");
    expect(descreverEventoPedido("pedido.ligado", { tipo: "DUPLICADO", papel: "ANTIGO", protocolo: "2027-0009" })).toBe(
      "Relatado de novo em 2027-0009",
    );
    expect(descreverEventoPedido("pedido.ligacao_desfeita", { protocolo: "2027-0001", motivo: "liguei errado" })).toBe(
      "Ligação com 2027-0001 desfeita. Motivo: liguei errado",
    );
    expect(descreverEventoPedido("pedido.decisao_pedida", { alternativas: 2, prazo: "2027-03-20" })).toBe(
      "Decisão pedida ao síndico · 2 alternativas · prazo 20/03/2027",
    );
    expect(descreverEventoPedido("pedido.decisao_respondida", { aprovada: true, alternativa: 1 })).toBe("Decisão respondida: aprovada a alternativa 1");
    expect(descreverEventoPedido("pedido.decisao_respondida", { aprovada: false })).toBe("Decisão devolvida sem decidir");
    expect(descreverEventoPedido("pedido.decisao_retirada", { motivo: "Pedido cancelado" })).toBe("Pedido de decisão retirado. Motivo: Pedido cancelado");
    expect(descreverEventoDecisao("pedido.registrado", {})).toBeNull();
  });
  it("a janela dos parecidos aparece no histórico do condomínio", () => {
    expect(descreverEvento({ acao: "parecidos.alterados", entidade: "configuracao_condominio", dados: { antes: 90, depois: 60 } })).toBe(
      "Pedidos parecidos: procurar nos últimos 60 dias (antes 90)",
    );
  });
});

describe("custo das alternativas (PT-09)", () => {
  it("mostra em reais, sem centavos quando redondo", () => {
    expect(mostrarCusto(240000)).toBe("R$ 2.400");
    expect(mostrarCusto(115050)).toBe("R$ 1.150,50");
    expect(mostrarCusto(0)).toBe("R$ 0");
  });
  it("resume a faixa de custo das alternativas", () => {
    expect(resumoAlternativas([{ custo: 1890000 }, { custo: 240000 }])).toBe("2 alternativas, de R$ 2.400 a R$ 18.900");
    expect(resumoAlternativas([{}, { custo: null }])).toBe("2 alternativas, sem custo");
    expect(resumoAlternativas([{ custo: 50000 }])).toBe("1 alternativa, R$ 500");
  });
});

describe("prazo da decisão aguardando", () => {
  it("diz quanto falta ou quando venceu", () => {
    expect(prazoDaDecisao("2026-10-24", "2026-10-20")).toEqual({ texto: "Vence em 4 dias", tom: "atencao" });
    expect(prazoDaDecisao("2026-10-19", "2026-10-20")).toEqual({ texto: "Venceu ontem", tom: "erro" });
    expect(prazoDaDecisao("2026-10-15", "2026-10-20")).toEqual({ texto: "Venceu em 15/10", tom: "erro" });
    expect(prazoDaDecisao("2026-10-20", "2026-10-20").texto).toBe("Vence hoje");
    expect(prazoDaDecisao("2026-10-21", "2026-10-20").texto).toBe("Vence amanhã");
    expect(prazoDaDecisao("2026-10-28", "2026-10-20")).toEqual({ texto: "Até 28/10", tom: "andamento" });
    expect(prazoDaDecisao("2026-11-02", "2026-10-30").texto).toBe("Vence em 3 dias");
  });
});

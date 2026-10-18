import { describe, expect, it } from "vitest";
import {
  concluirManutencaoSchema,
  contratoPertoDoFim,
  descreverEventoManutencao,
  descreverExecutor,
  descreverFrequencia,
  prestadorSchema,
  preventivaSchema,
  registrarManutencaoSchema,
  responderItemSchema,
  situacaoManutencaoSchema,
  SUGESTOES_PREVENTIVAS,
  UNIDADES_TEMPO,
} from "./manutencao.ts";
import { descreverEventoPedido } from "./pedidos.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const V = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const BASE = { tipo: "CORRETIVA", titulo: "Bomba com ruído", local: "Casa de bombas", prioridadeId: U, responsavelId: V };

describe("manutenção (peça R6)", () => {
  it("MP-01: o que é, onde, a prioridade e o responsável; quem executa pode ficar em branco", () => {
    const d = registrarManutencaoSchema.parse(BASE);
    expect(d.prestadorId).toBeNull();
    expect(d.itens).toEqual([]);
    expect(registrarManutencaoSchema.safeParse({ ...BASE, titulo: "Bo" }).success).toBe(false);
    expect(registrarManutencaoSchema.safeParse({ ...BASE, prioridadeId: null }).success).toBe(false);
    expect(registrarManutencaoSchema.safeParse({ ...BASE, tipo: "PREVENTIVA" }).success).toBe(false);
  });

  it("MP-07: quem executa é um só, e a lista do que olhar é só da vistoria", () => {
    expect(registrarManutencaoSchema.safeParse({ ...BASE, prestadorId: U, executorTexto: "Zé da bomba" }).success).toBe(false);
    expect(registrarManutencaoSchema.safeParse({ ...BASE, executorTexto: " Zé da bomba " }).data?.executorTexto).toBe("Zé da bomba");
    expect(registrarManutencaoSchema.safeParse({ ...BASE, itens: ["Calhas"] }).success).toBe(false);
    expect(registrarManutencaoSchema.safeParse({ ...BASE, tipo: "VISTORIA", itens: ["Calhas", "Ralos"] }).success).toBe(true);
  });

  it("MP-02: pendente pede o que impede e o motivo; não deu pede o porquê", () => {
    expect(situacaoManutencaoSchema.safeParse({ versao: 1, estado: "PENDENTE" }).success).toBe(false);
    expect(situacaoManutencaoSchema.safeParse({ versao: 1, estado: "PENDENTE", pendenciaTipo: "PECA", pendenciaMotivo: "Rolamento" }).success).toBe(true);
    expect(situacaoManutencaoSchema.safeParse({ versao: 1, estado: "CONCLUIDA" }).success).toBe(false);
    expect(concluirManutencaoSchema.safeParse({ versao: 1, conclusao: "Feito", realizadaEm: "2026-10-17" }).success).toBe(false);
    expect(responderItemSchema.safeParse({ versao: 1, resultado: "NAO_DEU", observacao: null }).success).toBe(false);
    expect(responderItemSchema.safeParse({ versao: 1, resultado: "CERTO" }).success).toBe(true);
  });

  it("MP-05: o telefone do prestador vira +55 e a vigência só vale para contrato", () => {
    const p = prestadorSchema.parse({ nome: "HidroPress", servico: "Bombas", telefone: "(13) 99812-4455", acordo: "CHAMADO", email: "" });
    expect(p.telefone).toBe("+5513998124455");
    expect(p.email).toBeNull();
    expect(prestadorSchema.safeParse({ nome: "HidroPress", servico: "Bombas", acordo: "CHAMADO", contratoAte: "2027-03-01" }).success).toBe(false);
    expect(prestadorSchema.safeParse({ nome: "HidroPress", servico: "Bombas", acordo: "CONTRATO", contratoAte: "2027-03-01" }).success).toBe(true);
    expect(prestadorSchema.safeParse({ nome: "HidroPress", servico: "Bombas", acordo: "CHAMADO", telefone: "123" }).success).toBe(false);
  });

  it("MP-05: contrato perto do fim são 60 dias", () => {
    expect(contratoPertoDoFim("2026-12-15", "2026-10-17")).toBe(true);
    expect(contratoPertoDoFim("2027-03-01", "2026-10-17")).toBe(false);
    expect(contratoPertoDoFim("2026-10-01", "2026-10-17")).toBe(false);
    expect(contratoPertoDoFim(null, "2026-10-17")).toBe(false);
  });

  it("MP-03: frequência em semanas, meses ou anos, dentro do limite de cada uma", () => {
    const base = { atividade: "Teste do gerador", local: "Casa de máquinas", proximaData: "2026-10-24", responsavelId: V };
    expect(preventivaSchema.safeParse({ ...base, unidadeTempo: "SEMANA", intervalo: 2 }).data?.antecedenciaDias).toBe(15);
    expect(preventivaSchema.safeParse({ ...base, unidadeTempo: "SEMANA", intervalo: 60 }).success).toBe(false);
    expect(preventivaSchema.safeParse({ ...base, unidadeTempo: "ANO", intervalo: 11 }).success).toBe(false);
    expect(descreverFrequencia("MES", 1)).toBe("todo mês");
    expect(descreverFrequencia("MES", 6)).toBe("a cada 6 meses");
    expect(descreverFrequencia("SEMANA", 1)).toBe("toda semana");
    expect(descreverFrequencia("ANO", 1)).toBe("todo ano");
  });

  it("MP-13: as sugestões seguem os limites e nenhuma se repete", () => {
    expect(new Set(SUGESTOES_PREVENTIVAS.map((s) => s.atividade)).size).toBe(SUGESTOES_PREVENTIVAS.length);
    for (const s of SUGESTOES_PREVENTIVAS) expect(s.intervalo).toBeLessThanOrEqual(UNIDADES_TEMPO[s.unidadeTempo].max);
  });

  it("MP-04: o histórico conta o que aconteceu, e o pedido sabe da manutenção concluída", () => {
    expect(descreverEventoManutencao("manutencao.registrada", { tipo: "VISTORIA" })).toBe("Registrada como vistoria");
    expect(descreverEventoManutencao("manutencao.registrada", { tipo: "PREVENTIVA", preventiva: U, dataPrevista: "2026-10-20" }))
      .toBe("Aberta pela preventiva, para 20/10/2026");
    expect(descreverEventoManutencao("manutencao.situacao", { estado: "PENDENTE", pendenciaTipo: "PECA" })).toBe("Pendente · Aguardando peça");
    expect(descreverEventoManutencao("estado.mudou", { de: "CONCLUIDA", para: "EM_ANDAMENTO", evento: "REABERTA" })).toBe("Reaberta");
    expect(descreverEventoPedido("pedido.manutencao_concluida", {})).toBe("Manutenção ligada concluída: dê o retorno ao morador");
    expect(descreverExecutor({ tipo: "EQUIPE", nome: "Carlos" })).toBe("Carlos (equipe)");
    expect(descreverExecutor(null)).toBe("Sem executor");
  });
});

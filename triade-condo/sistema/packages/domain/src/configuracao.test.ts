// Configuração na implantação (PI-04, CF-01, CF-09, CF-12): as partes, os ajustes técnicos e o
// resumo para o síndico.
import { describe, expect, it } from "vitest";
import {
  ajusteAnexarSchema,
  ajusteParecidosSchema,
  conferirParteSchema,
  descreverSemana,
  GRUPOS_CONFIGURACAO,
  PARTES_CONFIGURACAO,
  resumoConfiguracao,
  textoEtapaConfiguracao,
  TOTAL_PARTES,
  type DadosResumo,
} from "./index.ts";

const ID = "6f1c2a4e-3b5d-4c7e-8f90-1a2b3c4d5e6f";
const URG = "7f1c2a4e-3b5d-4c7e-8f90-1a2b3c4d5e6f";

const dados: DadosResumo = {
  nome: "Residencial Ipê",
  horarios: {
    ATENDIMENTO: {
      intervalos: [1, 2, 3, 4, 5].flatMap((dia) => [
        { dia, inicio: "08:00", fim: "12:00" },
        { dia, inicio: "13:00", fim: "18:00" },
      ]).concat([{ dia: 6, inicio: "08:00", fim: "12:00" }]),
    },
  },
  categorias: [
    { id: ID, nome: "Limpeza", ativa: true },
    { id: "c2", nome: "Elevadores", ativa: true },
    { id: "c3", nome: "Antiga", ativa: false },
  ],
  prioridades: [
    { id: "p1", nome: "Normal", significado: "o comum", nivel: 2, ativa: true },
    { id: URG, nome: "Urgente", significado: "risco a pessoas ou ao prédio", nivel: 5, ativa: true },
  ],
  prazos: [
    { categoriaId: null, prioridadeId: null, horas: 24 },
    { categoriaId: null, prioridadeId: URG, horas: 4 },
  ],
  feriados: [{ data: "2027-04-21", descricao: "Aniversário de Brasília" }],
  areas: [{ nome: "Salão de festas", ativa: true }, { nome: "Churrasqueira", ativa: true }],
};

describe("configuração na implantação", () => {
  it("PI-04: são 11 partes, cada uma com o seu grupo", () => {
    expect(TOTAL_PARTES).toBe(11);
    expect(Object.values(PARTES_CONFIGURACAO).filter((p) => p.grupo === "TRIADE").map((p) => p.nome))
      .toEqual(["Etapas dos pedidos", "Etapas da manutenção"]);
    expect(Object.keys(GRUPOS_CONFIGURACAO)).toEqual(["TRIADE", "MONTA", "SINDICO"]);
  });

  it("CF-09: os ajustes técnicos aceitam só os valores do app", () => {
    expect(ajusteParecidosSchema.safeParse({ versao: 1, dias: 45 }).success).toBe(false);
    expect(ajusteParecidosSchema.safeParse({ versao: 1, dias: 60, motivo: "Pedido no chamado 2026-0031" }).success).toBe(true);
    expect(ajusteAnexarSchema.safeParse({ versao: 1, minutos: 20 }).success).toBe(false);
    expect(ajusteAnexarSchema.safeParse({ versao: 1, minutos: 15 }).success).toBe(true);
    expect(ajusteAnexarSchema.safeParse({ versao: 1, minutos: 30, motivo: "x".repeat(501) }).success).toBe(false);
  });

  it("PI-04: conferir só as 11 partes, com de onde veio opcional", () => {
    expect(conferirParteSchema.safeParse({ parte: "HORARIOS", nota: "Ata de 03/2026" }).success).toBe(true);
    expect(conferirParteSchema.safeParse({ parte: "TERMO" }).success).toBe(false);
  });

  it("PI-04: a semana vira uma frase, juntando os dias iguais", () => {
    expect(descreverSemana(dados.horarios.ATENDIMENTO.intervalos))
      .toBe("Segunda a sexta, das 8h às 12h e das 13h às 18h; sábado, das 8h às 12h");
    expect(descreverSemana([{ dia: 0, inicio: "07:30", fim: "11:00" }])).toBe("Domingo, das 7h30 às 11h");
    expect(descreverSemana([])).toBe("Sem horário definido");
  });

  it("PI-04: o resumo para o síndico sai da configuração, em linguagem simples", () => {
    const r = resumoConfiguracao(dados);
    expect(r.map((s) => s.titulo)).toEqual(["Atendimento", "Pedidos", "Feriados", "Áreas comuns", "O que é com vocês no app", "O que fica com a TRÍADE"]);
    expect(r[1]!.texto).toBe("2 categorias: Limpeza e Elevadores. Prioridades: Urgente (risco a pessoas ou ao prédio) e Normal (o comum). "
      + "Retorno em até 24 horas de atendimento; urgente em até 4 horas.");
  });

  it("PI-04: a etapa 4 já vem com o resumo, sem o que é de cada um", () => {
    const t = textoEtapaConfiguracao(dados);
    expect(t.startsWith("Atendimento: Segunda a sexta")).toBe(true);
    expect(t).not.toContain("O que fica com a TRÍADE");
  });
});

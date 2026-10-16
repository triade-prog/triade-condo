import { describe, expect, it } from "vitest";
import { descreverEvento, formatarDataHora, mostrarTelefone } from "./eventos.ts";

describe("histórico legível (PI-12)", () => {
  it("diz o que mudou sem termo técnico", () => {
    expect(descreverEvento({ acao: "ficha.alterada", entidade: "condominio", dados: { campos: ["endereco", "numeroWhatsapp"] } }))
      .toBe("Ficha alterada: endereço, número institucional");
    expect(descreverEvento({ acao: "cenario.escolhido", entidade: "condominio", dados: { de: "SEM_PORTARIA", para: "PORTARIA_REMOTA" } }))
      .toBe("Cenário trocado: Prédio sem portaria → Portaria remota");
    expect(descreverEvento({ acao: "estado.mudou", entidade: "clientes", dados: { de: "IMPLANTACAO", para: "ATIVO", motivo: "Síndica fez o primeiro acesso" } }))
      .toBe("Estágio: Em implantação → Ativo. Motivo: Síndica fez o primeiro acesso");
    expect(descreverEvento({ acao: "equipe.funcoes_alteradas", entidade: "pessoa", dados: { antes: ["IMPLANTACAO"], depois: ["SUPORTE"] } }))
      .toBe("Funções revistas: Implantação → Suporte");
  });

  it("evento desconhecido aparece pelo código, sem quebrar", () => {
    expect(descreverEvento({ acao: "algo.novo", entidade: "x", dados: {} })).toBe("algo.novo");
  });

  it("datas no horário de Brasília e telefone legível", () => {
    expect(formatarDataHora("2026-10-16T17:05:00Z")).toBe("16/10/2026 14:05");
    expect(mostrarTelefone("+5561999990001")).toBe("+55 61 99999-0001");
  });
});

describe("eventos do passo 2", () => {
  it("configurações e pessoas autorizadas em frase curta", () => {
    expect(descreverEvento({ acao: "feriado.incluido", entidade: "feriado", dados: { data: "2026-11-20" } })).toBe("Feriado incluído: 20/11/2026");
    expect(descreverEvento({ acao: "pessoa.alterada", entidade: "vinculo", dados: { antes: ["CONFIGURAR"], depois: [] } }))
      .toBe("Permissões revistas: Configurar → só ver");
    expect(descreverEvento({ acao: "categoria.criada", entidade: "categoria", dados: {} })).toBe("Categoria criada");
  });
});

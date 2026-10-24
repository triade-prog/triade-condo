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

  it("na equipe, diz de quem o evento fala quando o nome vem (D4.28)", () => {
    const alvo = { id: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", nome: "Inês" };
    expect(descreverEvento({ acao: "equipe.membro_cadastrado", entidade: "pessoa", dados: { funcoes: ["IMPLANTACAO"] }, alvo }))
      .toBe("Inês entrou na equipe · Implantação");
    expect(descreverEvento({ acao: "equipe.membro_desativado", entidade: "pessoa", dados: {}, alvo })).toBe("Inês saiu da equipe");
    expect(descreverEvento({ acao: "equipe.funcoes_alteradas", entidade: "pessoa", dados: { antes: ["IMPLANTACAO"], depois: ["IMPLANTACAO", "SUPORTE"] }, alvo }))
      .toBe("Funções de Inês revistas · Implantação → Implantação, Suporte");
    expect(descreverEvento({ acao: "equipe.membro_cadastrado", entidade: "pessoa", dados: { funcoes: ["SUPORTE"] }, alvo: null }))
      .toBe("Pessoa cadastrada na equipe · Suporte");
    expect(descreverEvento({ acao: "equipe.membro_desativado", entidade: "pessoa", dados: {} })).toBe("Pessoa desativada da equipe");
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

describe("repasse ao revogar (0297; CF-05, MP-01)", () => {
  it("diz o que passou para quem assumiu, sem nomes", () => {
    expect(descreverEvento({ acao: "pessoa.repasse", entidade: "vinculo", dados: {
      pedidos: { para: "x", quantidade: 2 }, manutencoes: { para: "y", quantidade: 1, preventivas: 1 } } }))
      .toBe("Repasse ao revogar · 2 pedidos passaram para quem assumiu · 1 manutenção e 1 preventiva com quem assumiu");
    expect(descreverEvento({ acao: "pessoa.repasse", entidade: "vinculo", dados: { pedidos: { para: null, quantidade: 1 } } }))
      .toBe("Repasse ao revogar · 1 pedido ficou na fila sem responsável");
    expect(descreverEvento({ acao: "pessoa.repasse", entidade: "vinculo", dados: { pedidos: { para: null, quantidade: 0 } } }))
      .toBe("Repasse ao revogar · nada em aberto");
  });
});

// Menu da Plataforma (DC15, docs/design/telas-modelo/moldura-*.html): grupos, atalhos do celular
// e o item aceso em cada tela.
import { describe, expect, it } from "vitest";
import { atalhosDoCelular, conjuntoDoCaminho, ITENS_MENU, itemDoCaminho } from "./menu.ts";

describe("menu da Plataforma (DC15)", () => {
  it("o Início e os quatro grupos, na ordem do desenho aprovado", () => {
    expect(ITENS_MENU.map((i) => `${i.grupo ?? "-"}: ${i.texto}`)).toEqual([
      "-: Início",
      "Dia a dia: Pedidos", "Dia a dia: Decisões", "Dia a dia: Agenda", "Dia a dia: Manutenção", "Dia a dia: Portaria",
      "Comunicação: Comunicados", "Comunicação: WhatsApp", "Comunicação: Vida em condomínio",
      "Prédio e pessoas: Moradores e unidades", "Prédio e pessoas: Documentos e memória", "Prédio e pessoas: Indicadores",
      "Gestão: Configurações", "Gestão: Pessoas e acesso", "Gestão: Ajuda e suporte",
    ]);
  });

  it("a barra de baixo do celular tem Início, Pedidos, Agenda e WhatsApp (e o Mais)", () => {
    expect(ITENS_MENU.filter((i) => i.atalho === true).map((i) => i.texto)).toEqual(["Início", "Pedidos", "Agenda", "WhatsApp"]);
  });

  it("PA-01: quem só cuida da portaria tem Início e Portaria na barra de baixo; o síndico continua com os quatro", () => {
    const de = (textos: string[]) => atalhosDoCelular(ITENS_MENU.filter((i) => textos.includes(i.texto))).map((i) => i.texto);
    expect(de(["Início", "Portaria", "Configurações"])).toEqual(["Início", "Portaria"]);
    expect(de(["Início", "Pedidos", "Agenda", "Portaria", "WhatsApp"])).toEqual(["Início", "Pedidos", "Agenda", "WhatsApp"]);
    expect(itemDoCaminho("/portaria/unidade")?.texto).toBe("Portaria");
  });

  it("cada tela acende o item certo, o caminho mais comprido ganha", () => {
    const de = (c: string) => itemDoCaminho(c)?.texto ?? null;
    expect(de("/")).toBe("Início");
    expect(de("/pedidos")).toBe("Pedidos");
    expect(de("/pedidos/pedido")).toBe("Pedidos");
    expect(de("/comunicados")).toBe("Comunicados");
    expect(de("/comunicados/escrever")).toBe("Comunicados");
    expect(de("/documentos")).toBe("Documentos e memória");
    expect(de("/documentos/prontuario")).toBe("Documentos e memória");
    expect(de("/documentos/documento")).toBe("Documentos e memória");
    expect(de("/comunicados/documentos")).toBe("Documentos e memória");
    expect(de("/comunicados/documento")).toBe("Documentos e memória");
    expect(de("/memoria")).toBe("Documentos e memória");
    expect(de("/pedidosx")).toBe(null);
    expect(de("/busca")).toBe(null);
  });

  it("E.1: cada tela sabe o conjunto do plano a que pertence; a base não tem conjunto", () => {
    expect(conjuntoDoCaminho("/agenda/compromisso")).toBe("AGENDA");
    expect(conjuntoDoCaminho("/manutencao/preventivas")).toBe("MANUTENCAO");
    expect(conjuntoDoCaminho("/vida/enquete")).toBe("VIDA");
    expect(conjuntoDoCaminho("/memoria")).toBe("COMUNICACAO_AMPLIADA");
    expect(conjuntoDoCaminho("/documentos/dossie")).toBe("COMUNICACAO_AMPLIADA");
    expect(conjuntoDoCaminho("/documentos")).toBeNull();
    expect(conjuntoDoCaminho("/pedidos")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { PERMISSOES } from "@triade/domain";
import { comCaixa, comNivel, comVerCaixas, fraseDoAcesso, GRUPOS_ACESSO, gruposDisponiveis, resumoDaArea, type AreaCaixas, type AreaNivel } from "./acesso.ts";

const area = (id: string) => GRUPOS_ACESSO.flatMap((g) => g.areas).find((a) => a.id === id)!;

describe("acesso por área (B.1)", () => {
  it("cada permissão do banco aparece numa área, uma vez só", () => {
    const codigos = GRUPOS_ACESSO.flatMap((g) => g.areas).flatMap((a) => (a.tipo === "nivel" ? [a.ver, a.cuidar] : [a.ver, ...a.caixas.map((c) => c.codigo)])).filter(Boolean);
    expect([...codigos].sort()).toEqual(Object.keys(PERMISSOES).sort());
  });

  it("o nível troca os dois códigos da área", () => {
    const agenda = area("agenda") as AreaNivel;
    expect(comNivel(agenda, ["VER_AGENDA", "CONFIGURAR"], "cuidar")).toEqual(["CONFIGURAR", "AGENDA"]);
    expect(comNivel(agenda, ["AGENDA"], "nao")).toEqual([]);
  });

  it("nos pedidos, marcar outra caixa marca o ver; tirar o ver tira tudo", () => {
    const pedidos = area("pedidos") as AreaCaixas;
    expect(comCaixa(pedidos, [], "RESPONDER", true).sort()).toEqual(["ACOMPANHAR", "RESPONDER"]);
    expect(comCaixa(pedidos, ["ACOMPANHAR", "RESPONDER", "CADASTRAR"], "ACOMPANHAR", false)).toEqual(["CADASTRAR"]);
  });

  it("sem ver os comunicados, publicar e cuidar dos documentos saem", () => {
    const c = area("comunicados") as AreaCaixas;
    expect(comVerCaixas(c, ["VER_COMUNICADOS", "PUBLICAR", "AGENDA"], false)).toEqual(["AGENDA"]);
  });

  it("a frase diz o que a pessoa faz, na ordem do menu", () => {
    expect(fraseDoAcesso([])).toBe("Só vê o painel e as configurações");
    expect(fraseDoAcesso(["CONFIGURAR", "CADASTRAR"])).toBe("Cuida das configurações · cadastra moradores");
    expect(fraseDoAcesso(["ACOMPANHAR", "RESPONDER", "ATUALIZAR", "AGENDA", "VER_MANUTENCAO", "VER_COMUNICADOS", "CONFIGURAR"]))
      .toBe("Cuida dos pedidos (sem concluir), da agenda e das configurações · vê a manutenção, os comunicados e os documentos");
    expect(resumoDaArea(area("pedidos"), ["ACOMPANHAR", "RESPONDER"]).nivel).toBe("Cuida, sem atualizar nem concluir");
  });

  it("só mostra o que o banco tem", () => {
    const g = gruposDisponiveis(["CONFIGURAR", "CADASTRAR"]);
    expect(g.map((x) => x.grupo)).toEqual(["Prédio e pessoas", "Gestão"]);
  });
});

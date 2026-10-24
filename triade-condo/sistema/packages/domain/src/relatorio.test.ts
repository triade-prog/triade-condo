import { describe, expect, it } from "vitest";
import {
  conferirAnexoRelatorio, gerarRelatorioSchema, mesAnterior, nomeDoArquivoRelatorio, planilhaDoRelatorio, resumoSugerido, rodapeDoRelatorio,
  tabelasDoRelatorio, tituloDoMes, type NumerosRelatorio, type RelatorioGerado,
} from "./relatorio.ts";
import { descreverEvento } from "./eventos.ts";

const ARQ = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const atend = (registrados: number, concluidos: number, total: number, noPrazo: number) => ({
  registrados, concluidos, reabertos: 1, retornos: { total, noPrazo, porcentagem: total ? Math.round((100 * noPrazo) / total) : null }, primeiroRetornoHoras: total ? 5 : null,
});
const N: NumerosRelatorio = {
  mes: "2026-09", de: "2026-09-01", ate: "2026-09-30", fuso: "America/Sao_Paulo", foraPorPermissao: [],
  atendimento: { atual: atend(45, 41, 20, 17), anterior: atend(38, 35, 20, 16) },
  categorias: [
    { chave: "c1", nome: "Manutenção", registrados: 20, concluidos: 18, tempoMedioHoras: 36, retornos: 10, noPrazo: 8, porcentagem: 80 },
    { chave: "c2", nome: "Limpeza", registrados: 3, concluidos: 0, tempoMedioHoras: null, retornos: 0, noPrazo: 0, porcentagem: null },
  ],
  torres: [{ chave: "AREAS_COMUNS", nome: "Áreas comuns e sem unidade", registrados: 5, concluidos: 5, tempoMedioHoras: 12, retornos: 2, noPrazo: 2, porcentagem: 100 }],
  autor: { nome: "Ana Souza", cargo: "Síndica", sindico: true },
};
const R = (partes: RelatorioGerado["partes"], conteudo: NumerosRelatorio = N) => ({ partes, conteudo, mes: "2026-09", numero: 2 });

describe("relatório do mês (TR-02, TR-05, TR-08, TR-10)", () => {
  it("TR-02: o resumo pronto usa os números do mês e compara com o anterior, sem inventar causa", () => {
    expect(resumoSugerido(N)).toBe(
      "Em setembro, o condomínio registrou 45 pedidos e concluiu 41. 85% dos retornos foram dados no prazo combinado, 5 pontos acima de agosto. Manutenção foi a categoria com mais pedidos (20).");
    const vazio = { ...N, atendimento: { atual: atend(0, 0, 0, 0), anterior: atend(0, 0, 0, 0) }, categorias: [] };
    expect(resumoSugerido(vazio)).toBe("Em setembro, o condomínio não registrou pedidos.");
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(tituloDoMes("2026-09")).toBe("Setembro de 2026");
  });

  it("TR-05: por categoria e por torre com tempo médio de fechamento; sem caso é sem dados, nunca zero", () => {
    const [cat, torre] = tabelasDoRelatorio(R(["CATEGORIA", "TORRE"]));
    expect(cat!.tabela.cabecalho).toEqual(["Categoria", "Registrados", "Concluídos", "Tempo médio de fechamento", "Retornos no prazo"]);
    expect(cat!.tabela.linhas[0]).toEqual(["Manutenção", "20", "18", "1 dia e 12 h", "80% · 8 de 10"]);
    expect(cat!.tabela.linhas[1]!.slice(3)).toEqual(["sem dados", "sem dados"]);
    expect(torre!.tabela.linhas[0]![0]).toBe("Áreas comuns e sem unidade");
  });

  it("TR-08: a planilha tem as mesmas linhas da folha e diz o que ficou fora por permissão", () => {
    const csv = planilhaDoRelatorio(R(["RESUMO", "ATENDIMENTO", "DECISOES"], { ...N, foraPorPermissao: ["DECISOES"] }));
    expect(csv.startsWith("﻿Relatório de setembro de 2026;versão 2\r\n")).toBe(true);
    expect(csv).toContain("Atendimento do mês;Setembro;Agosto\r\nRegistrados;45;38\r\n");
    expect(csv).toContain("Fora por permissão: Decisões do síndico");
    expect(csv).not.toContain("Pedidas");
    expect(rodapeDoRelatorio({ conteudo: { ...N, foraPorPermissao: ["DECISOES"] } }, "01/10/2026 às 09:00"))
      .toContain("Gerado por Ana Souza com as partes que essa pessoa pode ver: Decisões do síndico ficou de fora.");
    expect(nomeDoArquivoRelatorio({ mes: "2026-09", numero: 2 }, "pdf")).toBe("relatorio-2026-09-v2.pdf");
    expect(descreverEvento({ acao: "relatorio.baixado", dados: { mes: "2026-09", formato: "CSV" } } as never)).toBe("Relatório de setembro de 2026 baixado em planilha");
  });

  it("TR-10: anexo é documento ou arquivo, até 10; só JPG, PNG e PDF de até 10 MB; texto vazio vira nulo", () => {
    const ok = gerarRelatorioSchema.parse({ mes: "2026-09", partes: ["RESUMO"], resumo: "  Texto.  ", palavra: "   ", anexos: [{ arquivoId: ARQ }] });
    expect(ok).toMatchObject({ resumo: "Texto.", palavra: null, guardarModelo: false });
    expect(gerarRelatorioSchema.safeParse({ mes: "2026-9", partes: ["RESUMO"] }).success).toBe(false);
    expect(gerarRelatorioSchema.safeParse({ mes: "2026-09", partes: [] }).success).toBe(false);
    expect(gerarRelatorioSchema.safeParse({ mes: "2026-09", partes: ["RESUMO"], anexos: [{ arquivoId: ARQ, documentoId: ARQ }] }).success).toBe(false);
    expect(gerarRelatorioSchema.safeParse({ mes: "2026-09", partes: ["RESUMO"], anexos: Array.from({ length: 11 }, () => ({ arquivoId: ARQ })) }).success).toBe(false);
    expect(conferirAnexoRelatorio({ type: "image/webp", size: 10 })).toMatch(/JPG ou PNG/);
    expect(conferirAnexoRelatorio({ type: "application/pdf", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(conferirAnexoRelatorio({ type: "image/png", size: 10 })).toBe(null);
  });
});

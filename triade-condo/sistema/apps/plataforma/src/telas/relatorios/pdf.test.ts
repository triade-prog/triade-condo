// O PDF único do relatório (TR-10, D.1): a folha com as partes, a foto dentro dela e as páginas do
// PDF anexado depois; anexo que não baixou vira uma linha, sem quebrar o arquivo.
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { RelatorioGerado } from "@triade/domain";
import { montarPdf } from "./pdf.ts";

const fonte = (p: string) => {
  const b = readFileSync(new URL(`../../../public/fontes/manrope-latin-${p}-normal.woff`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const CORES = { tinta: "#1e1531", suave: "#5e5475", linha: "#e4dcf1", violeta: "#5808cc", violeta7: "#4706a6" };
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const R: RelatorioGerado = {
  id: "r1", mes: "2026-09", numero: 1, partes: ["RESUMO", "ATENDIMENTO", "PALAVRA"], resumo: "Em setembro, o condomínio registrou 45 pedidos.", palavra: "Obrigada a todos.",
  geradoEm: "2026-10-01T12:00:00Z", ultimo: true, anexos: [],
  conteudo: {
    mes: "2026-09", de: "2026-09-01", ate: "2026-09-30", fuso: "America/Sao_Paulo", foraPorPermissao: [],
    atendimento: {
      atual: { registrados: 45, concluidos: 41, reabertos: 2, retornos: { total: 20, noPrazo: 17, porcentagem: 85 }, primeiroRetornoHoras: 5 },
      anterior: { registrados: 38, concluidos: 35, reabertos: 1, retornos: { total: 0, noPrazo: 0, porcentagem: null }, primeiroRetornoHoras: null },
    },
  },
};

describe("PDF do relatório do mês (TR-10)", () => {
  it("junta a folha, a foto e as páginas do PDF anexado num arquivo só", async () => {
    const anexo = await PDFDocument.create();
    anexo.addPage(); anexo.addPage();
    const bytes = await montarPdf(R, { condominio: "Residencial Ipê", geradoEmTexto: "01/10/2026 às 09:00", fontes: { normal: fonte("400"), forte: fonte("600") }, cores: CORES }, [
      { titulo: "Foto da fachada", tipo: "image/png", bytes: new Uint8Array(PNG_1PX) },
      { titulo: "Orçamento", tipo: "application/pdf", bytes: await anexo.save() },
      { titulo: "Não baixou", tipo: "application/pdf", bytes: null },
    ]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getTitle()).toBe("Relatório de setembro de 2026 · Residencial Ipê");
  });

  it("um PDF anexado que não abre vira uma linha e o arquivo sai", async () => {
    const bytes = await montarPdf(R, { condominio: "Residencial Ipê", geradoEmTexto: "01/10/2026 às 09:00", fontes: { normal: fonte("400"), forte: fonte("600") }, cores: CORES },
      [{ titulo: "Quebrado", tipo: "application/pdf", bytes: new TextEncoder().encode("não é pdf") }]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abaDaSituacao,
  aceitePropostaSchema,
  cpfValido,
  custoPorApartamento,
  dadosVersaoSchema,
  formatarCpf,
  mensalComDesconto,
  OFERTA_INCLUIDO,
  OFERTA_PLANEJADO,
  referenciaComercialSchema,
  SITUACOES_PROPOSTA,
  TEXTO_ACEITE,
} from "./propostas.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";

const SQL = ["0304_comercial_propostas.sql", "0306_comercial_propostas_ajustes.sql"]
  .map((f) => readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), "utf8"))
  .join("\n");

describe("propostas do Comercial (0304)", () => {
  it("CPF com os dígitos verificadores, com ou sem pontuação", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("desconto na mensalidade e custo por apartamento como o banco (CM-19, L.1)", () => {
    expect(mensalComDesconto(22900, 10)).toBe(20610);
    expect(mensalComDesconto(22900, 12.5)).toBe(20038);
    expect(mensalComDesconto(22900, null)).toBe(22900);
    expect(custoPorApartamento(20610, 72)).toBe(286);
    expect(custoPorApartamento(22900, 72)).toBe(318);
    expect(custoPorApartamento(100, 1000)).toBe(1);
    expect(custoPorApartamento(22900, 0)).toBeNull();
  });

  it("cada situação da versão em vigor cai na sua aba; a substituída em nenhuma", () => {
    expect(abaDaSituacao("PRONTA")).toBe("EM_ABERTO");
    expect(abaDaSituacao("AGUARDA_DESCONTO")).toBe("AGUARDANDO_APROVACAO");
    expect(abaDaSituacao("VENCIDA")).toBe("VENCIDAS");
    expect(abaDaSituacao("SUBSTITUIDA")).toBeNull();
    for (const s of Object.keys(SITUACOES_PROPOSTA)) expect(SQL).toContain(`'${s}'`);
  });

  it("a versão: desconto pede o motivo; sob consulta pede de onde veio o valor; preço não vem da tela", () => {
    const ok = dadosVersaoSchema.parse({ desconto: 10, descontoMotivo: "Conselho compara", mensal: 1 });
    expect(ok).not.toHaveProperty("mensal");
    expect(ok.ciclo).toBe("MENSAL");
    expect(dadosVersaoSchema.safeParse({ desconto: 10 }).error?.issues.map((i) => i.path[0])).toEqual(["descontoMotivo"]);
    expect(dadosVersaoSchema.safeParse({ valorManual: 150000 }).error?.issues.map((i) => i.path[0])).toEqual(["valorManualMotivo"]);
    expect(dadosVersaoSchema.safeParse({ desconto: 100, descontoMotivo: "x y z" }).success).toBe(false);
    expect(dadosVersaoSchema.safeParse({ tabela: "MANUAL" }).success).toBe(false);
  });

  it("o aviso do aceite fala da impressão digital da versão, não do PDF (0306)", () => {
    expect(TEXTO_ACEITE).toContain("impressão digital dela");
    expect(TEXTO_ACEITE).not.toContain("PDF");
  });

  it("o aceite: nome, CPF validado, cargo e a confirmação", () => {
    expect(aceitePropostaSchema.parse({ nome: "Lúcia Prado", cpf: "529.982.247-25", cargo: "Síndica", concordo: true }).cpf).toBe("52998224725");
    expect(aceitePropostaSchema.safeParse({ nome: "Lúcia Prado", cpf: "529.982.247-24", cargo: "Síndica", concordo: true }).success).toBe(false);
    expect(aceitePropostaSchema.safeParse({ nome: "Lúcia Prado", cpf: "529.982.247-25", cargo: "Síndica", concordo: false }).success).toBe(false);
  });

  it("a referência com contato pede o contato; o caso pede as datas", () => {
    const base = { sindico: "Paulo Dias", condominio: "Edifício Ipê", escopo: "CONTATO", autorizadoEm: "2026-10-20", autorizacaoTexto: "Autorizou por WhatsApp" };
    expect(referenciaComercialSchema.safeParse(base).error?.issues.map((i) => i.path[0])).toEqual(["whatsapp"]);
    expect(referenciaComercialSchema.parse({ ...base, whatsapp: "61 98888-7777" }).whatsapp).toBe("5561988887777");
    expect(referenciaComercialSchema.safeParse({ ...base, escopo: "SO_NOME", casoTexto: "Metade do tempo nos pedidos" }).success).toBe(false);
  });

  it("o incluído e o planejado são os mesmos do banco (EM-07)", () => {
    expect(SQL).toContain(`'${JSON.stringify(OFERTA_INCLUIDO).replaceAll('","', '", "')}'::jsonb`);
    expect(SQL).toContain(`'${JSON.stringify(OFERTA_PLANEJADO).replaceAll('","', '", "')}'::jsonb`);
  });

  it("todo motivo que a 0304 e a 0306 mandam tem texto na tela", () => {
    const motivos = new Set<string>();
    for (const m of SQL.matchAll(/recusar_motivo\('(?:[^']|'')*',\s*'([A-Z_]+)'\)/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/"motivo":"([A-Z_]+)"/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/'motivo', '([A-Z_]+)'/g)) motivos.add(m[1]!);
    expect(motivos.size).toBeGreaterThan(15);
    expect([...motivos].filter((m) => !TEXTOS_MOTIVO[m]).sort()).toEqual([]);
  });
});

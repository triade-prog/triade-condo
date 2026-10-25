/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  diaDoMes,
  mesComercialSchema,
  metaComercialSchema,
  MOTIVOS_INICIO_COMERCIAL,
  percentual,
  sindicoNovoSchema,
  TIPOS_JANELA,
  tratarJanelaSchema,
} from "./comercial.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";

const SQL = readFileSync(new URL("../../../supabase/migrations/0309_comercial_painel_janelas.sql", import.meta.url), "utf8");
const PESSOA = "6f1d7a52-1c1f-4f7e-9f3a-2b8b5c0c9a11";

describe("painel comercial e janelas (0309)", () => {
  it("o mês vai de 01 a 12", () => {
    expect(mesComercialSchema.safeParse("2026-10").success).toBe(true);
    expect(mesComercialSchema.safeParse("2026-13").success).toBe(false);
    expect(mesComercialSchema.safeParse("2026-1").success).toBe(false);
    expect(diaDoMes("2026-10")).toBe("2026-10-01");
  });

  it("a meta tem total maior que zero e cada pessoa uma vez", () => {
    const ok = metaComercialSchema.parse({ mes: "2026-10", total: 500000, porPessoa: [{ pessoaId: PESSOA, centavos: 300000 }] });
    expect(ok).toEqual({ mes: "2026-10", versao: null, total: 500000, porPessoa: [{ pessoaId: PESSOA, centavos: 300000 }] });
    expect(metaComercialSchema.parse({ mes: "2026-10", versao: 2, total: 1 }).porPessoa).toEqual([]);
    expect(metaComercialSchema.safeParse({ mes: "2026-10", total: 0 }).success).toBe(false);
    const repetida = metaComercialSchema.safeParse({
      mes: "2026-10", total: 1, porPessoa: [{ pessoaId: PESSOA, centavos: 1 }, { pessoaId: PESSOA, centavos: 2 }],
    });
    expect(repetida.success).toBe(false);
    expect(repetida.error?.issues[0]?.path).toEqual(["porPessoa"]);
  });

  it("a meta por pessoa tem o mesmo limite do banco", () => {
    const m = SQL.match(/coalesce\(x ->> 'centavos', ''\) !~ '\^\[1-9\]\[0-9\]\{0,(\d+)\}\$'/);
    expect(m).not.toBeNull();
    const maior = Number("9".repeat(Number(m![1]) + 1));
    expect(maior).toBe(99_999_999_999);
    const com = (centavos: number) => metaComercialSchema.safeParse({ mes: "2026-10", total: 1, porPessoa: [{ pessoaId: PESSOA, centavos }] });
    expect(com(maior).success).toBe(true);
    expect(com(maior + 1).success).toBe(false);
    const maiuscula = metaComercialSchema.parse({ mes: "2026-10", total: 1, porPessoa: [{ pessoaId: PESSOA.toUpperCase(), centavos: 1 }] });
    expect(maiuscula.porPessoa[0]?.pessoaId).toBe(PESSOA);
    const repetida = metaComercialSchema.safeParse({
      mes: "2026-10", total: 1, porPessoa: [{ pessoaId: PESSOA, centavos: 1 }, { pessoaId: PESSOA.toUpperCase(), centavos: 2 }],
    });
    expect(repetida.success).toBe(false);
  });

  it("os tipos de janela são os mesmos do banco", () => {
    const m = SQL.match(/tipo\s+text not null check \(tipo in \(([^)]*)\)\)/);
    expect(m).not.toBeNull();
    const banco = [...m![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    expect(banco).toEqual(Object.keys(TIPOS_JANELA));
    expect(tratarJanelaSchema.safeParse({ tipo: "ASSEMBLEIA", data: "2026-11-28" }).success).toBe(true);
    expect(tratarJanelaSchema.safeParse({ tipo: "OUTRA", data: "2026-11-28" }).success).toBe(false);
  });

  it("os motivos do Início são os que o banco devolve, na mesma ordem", () => {
    const m = SQL.match(/case it\.motivo when 'PRIMEIRO_RETORNO' then 1 when 'ATRASADO' then 2 when 'PARADO' then 3 else 4 end/);
    expect(m).not.toBeNull();
    expect(Object.keys(MOTIVOS_INICIO_COMERCIAL)).toEqual(["PRIMEIRO_RETORNO", "ATRASADO", "PARADO", "JANELA"]);
  });

  it("síndico novo: o mandato acaba depois do começo; sem datas, vale hoje", () => {
    expect(sindicoNovoSchema.parse({ versao: 3 })).toEqual({ versao: 3, desde: null, mandatoAte: null });
    expect(sindicoNovoSchema.safeParse({ versao: 3, desde: "2026-10-10", mandatoAte: "2026-10-01" }).success).toBe(false);
    expect(sindicoNovoSchema.safeParse({ versao: 3, desde: "2026-10-10", mandatoAte: "2028-10-09" }).success).toBe(true);
  });

  it("a meta de mês passado tem texto", () => {
    expect(TEXTOS_MOTIVO.META_MES_PASSADO).toMatch(/já passou/);
  });

  it("percentual sem todo é nulo", () => {
    expect(percentual(10, 14)).toBe(71);
    expect(percentual(0, 0)).toBeNull();
  });
});

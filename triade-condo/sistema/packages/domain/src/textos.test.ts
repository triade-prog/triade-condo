/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEXTOS_MOTIVO } from "./textos.ts";

const MIGRATIONS = new URL("../../../supabase/migrations/", import.meta.url);
const API = new URL("../../../supabase/functions/", import.meta.url);

describe("Textos de erro na tela (D3)", () => {
  it("todo motivo de recusa do banco tem texto na tela", () => {
    const motivos = new Set<string>();
    for (const f of readdirSync(MIGRATIONS).filter((n: string) => n.endsWith(".sql"))) {
      const sql = readFileSync(new URL(f, MIGRATIONS), "utf8");
      for (const m of sql.matchAll(/recusar_motivo\('(?:[^']|'')*',\s*'([A-Z_]+)'\)/g)) motivos.add(m[1]!);
    }
    expect(motivos.size).toBeGreaterThan(100);
    expect([...motivos].filter((m) => !TEXTOS_MOTIVO[m]).sort()).toEqual([]);
  });

  it("os motivos que a API e o banco mandam fora de recusar_motivo também têm texto", () => {
    const motivos = new Set<string>();
    for (const app of ["api-plataforma/app.ts", "api-console/app.ts"]) {
      const ts = readFileSync(new URL(app, API), "utf8");
      for (const m of ts.matchAll(/motivo: "([A-Z_]+)"/g)) motivos.add(m[1]!);
    }
    for (const m of ["SEM_MODELO", "PAROU"]) motivos.add(m);
    expect([...motivos].filter((m) => !TEXTOS_MOTIVO[m]).sort()).toEqual([]);
  });

  it("os textos não usam emoji nem termo técnico", () => {
    for (const t of Object.values(TEXTOS_MOTIVO)) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\b(TC\d{3}|HTTP|null|undefined)\b/);
    }
  });
});

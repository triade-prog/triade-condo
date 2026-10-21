/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
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

const RAIZ = new URL("../../../", import.meta.url);

/** Os arquivos de tela e de domínio, sem testes, com os comentários tirados: sobra o que a pessoa lê. */
function textosDoCodigo(): { arquivo: string; linha: number; texto: string }[] {
  const saida: { arquivo: string; linha: number; texto: string }[] = [];
  const andar = (dir: URL, nome: string) => {
    for (const n of readdirSync(dir)) {
      const u = new URL(n, dir);
      if (statSync(u).isDirectory()) { if (n !== "node_modules" && !n.startsWith(".")) andar(new URL(`${n}/`, dir), `${nome}${n}/`); continue; }
      if (!/\.(ts|tsx)$/.test(n) || /\.test\.ts$|\.d\.ts$/.test(n)) continue;
      const sem = readFileSync(u, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|\s)\/\/.*$/gm, "$1");
      sem.split("\n").forEach((texto, i) => saida.push({ arquivo: `${nome}${n}`, linha: i + 1, texto }));
    }
  };
  for (const base of ["apps/plataforma/src/", "apps/console/src/", "packages/configuracoes/src/", "packages/ui/src/", "packages/domain/src/"]) andar(new URL(base, RAIZ), base);
  return saida;
}

describe("Textos das telas (coerência das telas, Entrega 1)", () => {
  it("nenhuma tela fala do WhatsApp como coisa que ainda vai chegar", () => {
    const linhas = textosDoCodigo();
    expect(linhas.length).toBeGreaterThan(5000);
    const velhos = linhas.filter((l) => /\bpasso \d/.test(l.texto) || (/próximo passo|chega(m)? depois|, depois, para o WhatsApp/.test(l.texto) && /WhatsApp/.test(l.texto)))
      .map((l) => `${l.arquivo}:${l.linha}`);
    expect(velhos).toEqual([]);
  });
});

// DC13: as telas usam os tokens do tema, nunca a cor escrita direto, e os nomes antigos da
// base de 16/10 (DC11) não voltam. Assim, ajustar a identidade continua sendo mudar um arquivo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..", "..");
const PASTAS = ["apps/plataforma/src", "apps/console/src", "packages/ui/src"];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !nome.endsWith(".test.ts") ? [caminho] : [];
  });
}

const TELAS = PASTAS.flatMap((p) => arquivos(join(RAIZ, p))).map((caminho) => ({
  caminho: caminho.slice(RAIZ.length + 1),
  texto: readFileSync(caminho, "utf8"),
}));

const ANTIGOS = /\b(?:[a-z]+:)*(?:bg|text|border|ring|accent|outline|divide|fill|stroke)-(?:acao|plataforma|console|lilas|selecao|lateral|faixa|detalhe)(?:-[a-z]+)?\b/g;

describe("cores das telas", () => {
  it("as telas leram arquivos", () => {
    expect(TELAS.length).toBeGreaterThan(50);
  });

  it("nenhuma cor escrita direto: só os tokens do tema", () => {
    const achados = TELAS.flatMap((t) => (t.texto.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => `${t.caminho}: ${c}`));
    expect(achados).toEqual([]);
  });

  it("nenhum nome de cor da base antiga (DC11)", () => {
    const achados = TELAS.flatMap((t) => (t.texto.match(ANTIGOS) ?? []).map((c) => `${t.caminho}: ${c}`));
    expect(achados).toEqual([]);
  });

  it("o tema não define mais os nomes antigos nem o tema escuro", () => {
    const tema = readFileSync(join(RAIZ, "packages/ui/src/tema.css"), "utf8");
    expect(tema).not.toMatch(/--color-(?:acao|plataforma|console|lilas|selecao|lateral|faixa|detalhe)/);
    expect(tema).not.toContain('data-theme="dark"');
  });
});

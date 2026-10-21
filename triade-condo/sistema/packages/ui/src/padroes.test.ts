// DC15 (docs/design/guia-padroes.html): as peças já feitas no padrão novo usam só a escala de
// letra com nome e os botões do sistema. A lista cresce a cada bloco do novo frontend (D4.2);
// quando todas as telas passarem, o teste vale para a pasta inteira, como o das cores.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..", "..");
const NO_PADRAO = [
  "apps/plataforma/src/telas/PainelPlataforma.tsx",
  "apps/plataforma/src/telas/menu.ts",
  "packages/ui/src/Estados.tsx",
  "packages/ui/src/Dialogo.tsx",
];
const PECAS = NO_PADRAO.map((caminho) => ({ caminho, texto: readFileSync(join(RAIZ, caminho), "utf8") }));

// Classes de peça do tema que um <button> pode usar (o resto sai de Botao ou classeBotao).
const BOTOES_DO_TEMA = new Set(["emblema", "pessoa", "condominio", "escolha"]);

describe("peças no padrão novo (DC15)", () => {
  it("nenhum tamanho de letra escrito direto: só a escala com nome", () => {
    const achados = PECAS.flatMap((p) => (p.texto.match(/\btext-(?:\[\d+(?:\.\d+)?px\]|xs|sm|base|lg|xl|[2-9]xl)\b/g) ?? []).map((t) => `${p.caminho}: ${t}`));
    expect(achados).toEqual([]);
  });

  it("nenhum botão feito à mão: Botao, classeBotao ou uma peça do tema", () => {
    const achados = PECAS.flatMap((p) =>
      [...p.texto.matchAll(/<button\b[^>]*?className="([^"]*)"/g)]
        .filter((m) => !m[1]!.split(/\s+/).some((c) => BOTOES_DO_TEMA.has(c)))
        .map((m) => `${p.caminho}: ${m[1]}`),
    );
    expect(achados).toEqual([]);
  });

  it("nenhuma tela usa emoji", () => {
    const achados = PECAS.filter((p) => /\p{Extended_Pictographic}/u.test(p.texto)).map((p) => p.caminho);
    expect(achados).toEqual([]);
  });
});

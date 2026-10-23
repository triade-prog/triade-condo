// DC15 (docs/design/guia-padroes.html): as telas usam só a escala de letra com nome e os botões do
// sistema. Desde a rodada de 23/10 (D4.2) o teste vale para a pasta inteira, como o das cores.
// Ficam fora da regra de letra só as folhas de imprimir (medida de papel) e a marca.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..", "..");
const PASTAS = ["apps/plataforma/src", "apps/console/src", "packages/ui/src", "packages/configuracoes/src"];
const IMPRESSOS = [
  "apps/plataforma/src/telas/comunicados/Mural.tsx",
  "apps/plataforma/src/telas/comunicados/Cartaz.tsx",
  "apps/plataforma/src/telas/comunicados/ComunicadosWhatsapp.tsx",
  "apps/plataforma/src/telas/memoria/DossieImpresso.tsx",
  "apps/console/src/telas/ficha/ResumoConfiguracao.tsx",
  "packages/configuracoes/src/ImprimirEtiquetas.tsx",
  "packages/ui/src/Impressos.tsx",
  "packages/ui/src/Marca.tsx",
];

function arquivos(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta), { withFileTypes: true }).flatMap((e) => {
    const caminho = `${pasta}/${e.name}`;
    if (e.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}
const PECAS = PASTAS.flatMap(arquivos).map((caminho) => ({ caminho, texto: readFileSync(join(RAIZ, caminho), "utf8") }));

// Classes de peça do tema que um <button> pode usar (o resto sai de Botao ou classeBotao).
const BOTOES_DO_TEMA = new Set(["emblema", "pessoa", "condominio", "escolha", "chip", "chip-atencao", "resumo-passo", "selo-botao", "tirar", "c", "elo", "elo-linha"]);

// Tamanho escrito direto abaixo de 30 px. Acima disso é número de destaque (indicador, saudação),
// que a escala não tem; com prefixo (max-md:) é o ajuste da peça no celular.
const TAMANHO = /(?<![\w:-])text-(?:\[(\d+(?:\.\d+)?)px\]|xs|sm|base|lg|xl|2xl)(?![\w-])/g;

describe("telas no padrão novo (DC15)", () => {
  it("lê as telas do app, do Console e das peças", () => {
    expect(PECAS.length).toBeGreaterThan(200);
    expect(PECAS.some((p) => p.caminho.endsWith("telas/pedidos/Pedido.tsx"))).toBe(true);
  });

  it("nenhum tamanho de letra escrito direto: só a escala com nome", () => {
    const achados = PECAS.filter((p) => !IMPRESSOS.includes(p.caminho)).flatMap((p) =>
      [...p.texto.matchAll(TAMANHO)].filter((m) => m[1] === undefined || Number(m[1]) < 30).map((m) => `${p.caminho}: ${m[0]}`),
    );
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

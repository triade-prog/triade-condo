import { describe, expect, it } from "vitest";
import {
  ajudaIaSchema,
  centavosDeMicros,
  chaveIaSchema,
  custoEstimadoCentavos,
  custoNoLimiteCentavos,
  custoSugestaoMicros,
  custoTranscricaoMicros,
  decidirSugestaoSchema,
  diaDeRenovar,
  duracaoOggOpus,
  formatoRespostaSugestao,
  interpretarSugestaoIa,
  limparTextoParaIa,
  mensagemSugestao,
  resumoAjudaIa,
  sugestaoRegistroSchema,
} from "./ia.ts";
import { descreverEventoPedido, registrarPedidoSchema } from "./pedidos.ts";
import { formatar, dinheiro } from "./dinheiro.ts";

const CAT = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const CAT2 = "3d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const PRI = "4d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const catalogo = {
  categorias: [{ id: CAT, nome: "Manutenção" }, { id: CAT2, nome: "Limpeza" }],
  prioridades: [{ id: PRI, nome: "Urgente", significado: "Risco ou dano acontecendo agora", nivel: 4 }],
};
const reais = (c: number) => formatar(dinheiro(c));

describe("IA-20 · Motor de IA com freio: custo de cada chamada", () => {
  it("modelo pequeno a US$ 0,10 e US$ 0,50 por milhão de tokens, em milionésimos de dólar", () => {
    expect(custoSugestaoMicros("claude-haiku-5-5", 1_000_000, 0)).toBe(100_000);
    expect(custoSugestaoMicros("claude-haiku-5-5", 0, 1_000_000)).toBe(500_000);
    expect(custoSugestaoMicros("claude-haiku-5-5", 900, 80)).toBe(130);
    expect(custoSugestaoMicros("modelo-desconhecido", 900, 80)).toBe(130);
  });

  it("transcrição a US$ 0,0045 por minuto", () => {
    expect(custoTranscricaoMicros(60)).toBe(4_500);
    expect(custoTranscricaoMicros(38)).toBe(2_850);
  });

  it("NG-15: os números do cartão IA e custo, com o dólar a R$ 5,50", () => {
    expect(reais(custoEstimadoCentavos(46, 0))).toBe("R$ 0,07");
    expect(reais(custoEstimadoCentavos(0, 18))).toBe("R$ 0,45");
    expect(reais(custoEstimadoCentavos(46, 18))).toBe("R$ 0,52");
    expect(reais(custoNoLimiteCentavos(250, 60))).toBe("R$ 1,86");
  });

  it("PT-09: a conta fica em inteiros e arredonda só para mostrar", () => {
    expect(centavosDeMicros(275)).toBe(0);
    expect(centavosDeMicros(275 * 1000)).toBe(151);
    expect(centavosDeMicros(1_000_000, "BRL")).toBe(100);
    expect(Number.isInteger(centavosDeMicros(12_345))).toBe(true);
  });
});

describe("IA-20 · o que vai para a IA: sem nome nem telefone", () => {
  it("tira telefone com e sem DDD, +55 e e-mail", () => {
    const t = limparTextoParaIa("Me liga no (61) 99999-1234 ou +55 61 98888 7777, ou ana.souza@email.com. Apto 101.");
    expect(t).toBe("Me liga no [telefone] ou [telefone], ou [e-mail]. Apto 101.");
  });

  it("tira o nome inteiro e cada parte, sem ligar para acento e maiúscula", () => {
    const t = limparTextoParaIa("Oi, aqui é a Ana Souza da Silva. A ANA vai estar em casa; o André também.", ["Ana Souza da Silva", "Andre Lima"]);
    expect(t).toBe("Oi, aqui é a [nome]. A [nome] vai estar em casa; o [nome] também.");
  });

  it("não tira pedaço de outra palavra nem partícula do nome", () => {
    const t = limparTextoParaIa("A banana da cozinha e o Mariano.", ["Ana", "Maria da Luz"]);
    expect(t).toBe("A banana da cozinha e o Mariano.");
  });

  it("mantém números curtos (unidade, andar, horário)", () => {
    expect(limparTextoParaIa("Torre A, 101, desde as 14:30, 3 vezes")).toBe("Torre A, 101, desde as 14:30, 3 vezes");
  });

  it("é pura: o mesmo texto dá sempre o mesmo resultado", () => {
    const a = limparTextoParaIa("Lia Prado, 61 3333-4444", ["Lia Prado"]);
    expect(limparTextoParaIa("Lia Prado, 61 3333-4444", ["Lia Prado"])).toBe(a);
    expect(a).toBe("[nome], [telefone]");
  });
});

describe("IA-17 · Classificar o pedido: a resposta do modelo", () => {
  it("pede só nomes do catálogo do condomínio", () => {
    const f = formatoRespostaSugestao(catalogo) as { properties: Record<string, { enum?: string[] }> };
    expect(f.properties.categoria!.enum).toEqual(["Manutenção", "Limpeza"]);
    expect(f.properties.prioridade!.enum).toEqual(["Urgente"]);
    expect(mensagemSugestao({ ...catalogo, texto: "Vazou" })).toContain("<relato>\nVazou\n</relato>");
  });

  it("troca os nomes pelos ids e corta o que passa do tamanho", () => {
    const r = interpretarSugestaoIa(
      JSON.stringify({ categoria: "manutencao", prioridade: "Urgente", local: "Banheiro social", porque: "Fala em vazamento.", confianca: "ALTA" }),
      catalogo,
    );
    expect(r).toEqual({ categoriaId: CAT, prioridadeId: PRI, local: "Banheiro social", porque: "Fala em vazamento.", confianca: "ALTA" });
  });

  it("IA-11: sem local no relato, o local fica vazio", () => {
    expect(interpretarSugestaoIa({ categoria: "Limpeza", prioridade: "Urgente", local: null, porque: "Sujeira.", confianca: "MEDIA" }, catalogo)?.local).toBeNull();
  });

  it("resposta fora do formato ou fora do catálogo não vira sugestão", () => {
    expect(interpretarSugestaoIa("não é json", catalogo)).toBeNull();
    expect(interpretarSugestaoIa({ categoria: "Jardim", prioridade: "Urgente", local: null, porque: "x", confianca: "ALTA" }, catalogo)).toBeNull();
    expect(interpretarSugestaoIa({ categoria: "Limpeza", prioridade: "Urgente", local: null, porque: "x", confianca: "TALVEZ" }, catalogo)).toBeNull();
  });
});

describe("IA-15 · A IA só sugere: as rotas e o histórico", () => {
  it("usar a sugestão é uma escolha explícita, com a versão do pedido", () => {
    expect(decidirSugestaoSchema.parse({ versao: 3, usar: true })).toEqual({ versao: 3, usar: true, categoriaId: null, prioridadeId: null, local: null });
    expect(decidirSugestaoSchema.safeParse({ usar: true }).success).toBe(false);
  });

  it("o registro manda a sugestão mostrada", () => {
    const r = registrarPedidoSchema.parse({ local: "Hall", categoriaId: CAT, prioridadeId: PRI, assunto: "Lâmpada", descricao: "Queimou", canal: "TELEFONE", sugestaoId: CAT2 });
    expect(r.sugestaoId).toBe(CAT2);
    expect(sugestaoRegistroSchema.safeParse({ relato: "curto" }).success).toBe(false);
  });

  it("o histórico diz o que a IA sugeriu quando a pessoa escolhe outra coisa", () => {
    expect(descreverEventoPedido("pedido.sugestao_usada", { categoria: "Manutenção", prioridade: "Urgente", local: "Banheiro social" }))
      .toBe("Usou a sugestão automática · Manutenção · Urgente · Banheiro social");
    expect(descreverEventoPedido("pedido.sugestao_recusada", { categoria: "Manutenção", prioridade: "Urgente", escolhida: { categoria: "Limpeza", prioridade: "Urgente" } }))
      .toBe("Escolheu Limpeza · a sugestão era Manutenção");
    expect(descreverEventoPedido("pedido.sugestao_pronta", {})).toBe("Sugestão automática pronta · espera quem atende confirmar");
  });
});

describe("IA-19 · Ajuda da IA em Configurações", () => {
  it("o resumo mostra o que está ligado e o uso, sem valores", () => {
    const base = { ligadaTriade: true, sugerir: { ligada: true }, transcrever: { ligada: true }, uso: { sugestoes: { usadas: 46, limite: 250 } } };
    expect(resumoAjudaIa(base)).toBe("Sugestão e transcrição ligadas · 46 de 250 sugestões no mês");
    expect(resumoAjudaIa({ ...base, transcrever: { ligada: false } })).toBe("Sugestão ligada · 46 de 250 sugestões no mês");
    expect(resumoAjudaIa({ ...base, ligadaTriade: false })).toBe("Desligada pela TRÍADE");
    expect(diaDeRenovar("2026-11-01")).toBe("01/11");
  });

  it("ligar e desligar pede as duas escolhas; a chave da TRÍADE pede motivo para desligar", () => {
    expect(ajudaIaSchema.safeParse({ versao: 1, sugerir: true }).success).toBe(false);
    expect(chaveIaSchema.safeParse({ versao: 1, ligada: false }).success).toBe(false);
    expect(chaveIaSchema.safeParse({ versao: 1, ligada: true }).success).toBe(true);
  });
});

describe("W-06 · duração do áudio do WhatsApp (OGG/Opus)", () => {
  const pagina = (granulo: number) => {
    const b = new Uint8Array(27);
    b.set([0x4f, 0x67, 0x67, 0x53, 0]);
    let g = granulo;
    for (let i = 0; i < 8; i++) { b[6 + i] = g % 256; g = Math.floor(g / 256); }
    return b;
  };
  it("lê os segundos pela última página", () => {
    const arq = new Uint8Array([...pagina(0), ...new Uint8Array(40), ...pagina(48_000 * 38)]);
    expect(duracaoOggOpus(arq)).toBe(38);
  });
  it("não é OGG: sem duração", () => {
    expect(duracaoOggOpus(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

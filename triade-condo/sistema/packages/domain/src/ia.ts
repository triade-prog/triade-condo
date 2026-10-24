// Motor de IA com freio (IA-20) e o que roda nele nesta entrega: a sugestão de categoria,
// prioridade e local (IA-17, IA-11 triagem), que nunca se aplica sozinha (IA-15), e a transcrição
// do áudio do WhatsApp (W-06). O custo (NG-13, NG-15) fica em milionésimos da moeda do provedor e
// vira reais só para mostrar. Os mesmos valores estão no banco (0298_motor_ia.sql).
// Funciona no Node e no Deno: nada aqui lê ambiente nem rede.

import { z } from "zod";

const versao = z.number().int().min(1);
const id = z.string().uuid();

// ---------------------------------------------------------------------------------------
// Funções, limites e preços.

export const FUNCOES_IA = {
  SUGERIR: "Sugerir categoria, prioridade e local",
  TRANSCREVER: "Transcrever áudios do WhatsApp",
} as const;
export type FuncaoIa = keyof typeof FUNCOES_IA;

/** Limite do mês, definido pela TRÍADE (escolha 2 das notas da IA 1). */
export const LIMITES_IA_PADRAO = { sugestoes: 250, transcricaoMinutos: 60 } as const;

export const MODELO_SUGERIR_PADRAO = "claude-haiku-5-5";

/** Situação da função agora, como o banco devolve. */
export const SITUACOES_FUNCAO_IA = {
  LIGADA: "Ligada",
  DESLIGADA: "Desligada pelo condomínio",
  DESLIGADA_TRIADE: "Desligada pela TRÍADE",
  LIMITE: "Parada até o mês virar",
  SEM_SERVICO: "Sem serviço de transcrição",
} as const;
export type SituacaoFuncaoIa = keyof typeof SITUACOES_FUNCAO_IA;

/**
 * Tabela de preços usada na estimativa (provedor, 06/10/2026), em milionésimos de dólar.
 * Modelo pequeno: US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por milhão de saída.
 * Transcrição: US$ 0,0045 por minuto de áudio.
 */
export const PRECOS_IA = {
  tabelaDe: "2026-10-06",
  modelos: { "claude-haiku-5-5": { entradaPorMilhao: 100_000, saidaPorMilhao: 500_000 } } as Record<string, { entradaPorMilhao: number; saidaPorMilhao: number }>,
  transcricaoPorMinuto: 4_500,
  /** Uma sugestão típica (relato, catálogo e resposta curta): cerca de R$ 0,0015. */
  sugestaoTipica: 275,
  /** Dólar usado para mostrar em reais: R$ 5,50 (em centésimos de real por dólar). */
  dolarEmCentavos: 550,
} as const;

/** Custo de uma chamada do modelo, em milionésimos de dólar (inteiro, arredondado para cima). */
export function custoSugestaoMicros(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const p = PRECOS_IA.modelos[modelo] ?? PRECOS_IA.modelos[MODELO_SUGERIR_PADRAO]!;
  const entrada = Math.max(0, Math.trunc(tokensEntrada));
  const saida = Math.max(0, Math.trunc(tokensSaida));
  return Math.ceil((entrada * p.entradaPorMilhao + saida * p.saidaPorMilhao) / 1_000_000);
}

/** Custo da transcrição, em milionésimos de dólar, pelos segundos do áudio. */
export function custoTranscricaoMicros(segundos: number): number {
  return Math.ceil((Math.max(0, Math.trunc(segundos)) * PRECOS_IA.transcricaoPorMinuto) / 60);
}

/** Milionésimos (de dólar ou de real) → centavos de real, arredondados só no fim. */
export function centavosDeMicros(micros: number, moeda: "USD" | "BRL" = "USD"): number {
  const m = Math.max(0, Math.trunc(micros));
  return moeda === "BRL" ? Math.round(m / 10_000) : Math.round((m * PRECOS_IA.dolarEmCentavos) / 1_000_000);
}

/** Quanto custaria o mês se o condomínio usasse todo o limite (NG-15), em centavos de real. */
export function custoNoLimiteCentavos(limiteSugestoes: number, limiteMinutos: number): number {
  return centavosDeMicros(limiteSugestoes * PRECOS_IA.sugestaoTipica + limiteMinutos * PRECOS_IA.transcricaoPorMinuto);
}

/** O custo estimado do uso, quando a chamada não trouxe o valor real. */
export function custoEstimadoCentavos(sugestoes: number, minutos: number): number {
  return centavosDeMicros(sugestoes * PRECOS_IA.sugestaoTipica + minutos * PRECOS_IA.transcricaoPorMinuto);
}

// ---------------------------------------------------------------------------------------
// O que vai para a IA: o texto sem nome, telefone nem e-mail.

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LETRAS: Record<string, string> = {
  a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]", n: "[nñ]",
};

/** Partes de nome que não se tiram sozinhas (ligam nomes e são palavras comuns). */
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Tira do texto o que identifica a pessoa antes de ir para a IA: e-mails, telefones (com ou sem
 * DDD e +55), números longos (CPF, documentos) e os nomes dados (inteiros e cada parte com três
 * letras ou mais). Função pura: o mesmo texto e os mesmos nomes sempre dão o mesmo resultado.
 */
export function limparTextoParaIa(texto: string, nomes: readonly string[] = []): string {
  let t = texto.normalize("NFC");
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]");
  // Telefones e números longos: 8 ou mais dígitos com espaço, ponto, traço ou parênteses no meio.
  t = t.replace(/(\+?\(?\d[\d\s().-]{6,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 8 ? "[telefone]" : m));
  const partes = new Set<string>();
  for (const nome of nomes) {
    const n = nome.trim();
    if (n.length < 3) continue;
    partes.add(n);
    for (const p of n.split(/\s+/)) if (p.length >= 3 && !PARTICULAS.has(p.toLowerCase())) partes.add(p);
  }
  // Do mais longo para o mais curto, para o nome inteiro sair de uma vez; sem ligar para acento
  // nem maiúscula ("Andre" tira "André").
  for (const p of [...partes].sort((a, b) => b.length - a.length)) {
    const corpo = [...semAcento(p).toLowerCase()].map((ch) => LETRAS[ch] ?? escapar(ch)).join("");
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, "giu"), "[nome]");
  }
  return t.replace(/(\[nome\]\s+){1,}\[nome\]/g, "[nome]");
}

// ---------------------------------------------------------------------------------------
// A sugestão (IA-17): o pedido ao modelo e a leitura da resposta.

export interface CatalogoIa {
  readonly categorias: readonly { id: string; nome: string }[];
  readonly prioridades: readonly { id: string; nome: string; significado?: string | null; nivel?: number | null }[];
}

export interface EntradaSugestao extends CatalogoIa {
  /** O texto já limpo (sem nome nem telefone). */
  readonly texto: string;
}

export const CONFIANCAS_IA = ["ALTA", "MEDIA", "BAIXA"] as const;
export type ConfiancaIa = (typeof CONFIANCAS_IA)[number];

/** O formato da resposta pedido ao modelo: só nomes que existem no catálogo do condomínio. */
export function formatoRespostaSugestao(catalogo: CatalogoIa): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["categoria", "prioridade", "local", "porque", "confianca"],
    properties: {
      categoria: { type: "string", enum: catalogo.categorias.map((c) => c.nome) },
      prioridade: { type: "string", enum: catalogo.prioridades.map((p) => p.nome) },
      local: { type: ["string", "null"], description: "Onde é, em poucas palavras, só se o relato disser" },
      porque: { type: "string", description: "Uma frase curta citando o que no relato levou à escolha" },
      confianca: { type: "string", enum: [...CONFIANCAS_IA] },
    },
  };
}

export const INSTRUCOES_SUGESTAO = [
  "Você ajuda quem atende pedidos de moradores num condomínio no Brasil.",
  "Leia o relato e escolha uma categoria e uma prioridade, só entre as opções dadas, e o local se o relato disser.",
  "Quem atende confirma: você só sugere. Não invente fatos; se o relato não basta, use confiança BAIXA.",
  "O texto vem sem nomes e telefones, trocados por [nome] e [telefone]. Não tente adivinhá-los.",
  "Responda em português do Brasil, com o porquê em uma frase curta.",
].join("\n");

export function mensagemSugestao(e: EntradaSugestao): string {
  const prioridades = e.prioridades.map((p) => `- ${p.nome}${p.significado ? `: ${p.significado}` : ""}`).join("\n");
  return [
    `Categorias em uso:\n${e.categorias.map((c) => `- ${c.nome}`).join("\n")}`,
    `Prioridades:\n${prioridades}`,
    `Relato do pedido:\n<relato>\n${e.texto}\n</relato>`,
  ].join("\n\n");
}

const respostaSugestaoSchema = z.object({
  categoria: z.string().min(1).max(120),
  prioridade: z.string().min(1).max(120),
  local: z.string().trim().max(200).nullable().optional(),
  porque: z.string().trim().max(1000).optional().default(""),
  confianca: z.enum(CONFIANCAS_IA),
});

export interface SugestaoInterpretada {
  readonly categoriaId: string;
  readonly prioridadeId: string;
  readonly local: string | null;
  readonly porque: string | null;
  readonly confianca: ConfiancaIa;
}

/**
 * Lê a resposta do modelo e troca os nomes pelos ids do catálogo. Resposta fora do formato, ou
 * com nome que não está no catálogo, dá null: sem sugestão, o pedido segue como sempre.
 */
export function interpretarSugestaoIa(resposta: unknown, catalogo: CatalogoIa): SugestaoInterpretada | null {
  let bruto = resposta;
  if (typeof bruto === "string") {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return null;
    }
  }
  const r = respostaSugestaoSchema.safeParse(bruto);
  if (!r.success) return null;
  const igual = (a: string, b: string) => semAcento(a).trim().toLowerCase() === semAcento(b).trim().toLowerCase();
  const categoria = catalogo.categorias.find((c) => igual(c.nome, r.data.categoria));
  const prioridade = catalogo.prioridades.find((p) => igual(p.nome, r.data.prioridade));
  if (!categoria || !prioridade) return null;
  const local = r.data.local?.trim().slice(0, 120) ?? "";
  const porque = r.data.porque.trim().slice(0, 400);
  return {
    categoriaId: categoria.id,
    prioridadeId: prioridade.id,
    local: local.length >= 2 ? local : null,
    porque: porque.length >= 3 ? porque : null,
    confianca: r.data.confianca,
  };
}

// ---------------------------------------------------------------------------------------
// O áudio: a duração do arquivo OGG/Opus (o áudio do WhatsApp), sem decodificar.

/** Segundos do OGG/Opus pela posição da última página (48 kHz), ou null se não for OGG. */
export function duracaoOggOpus(bytes: Uint8Array): number | null {
  if (bytes.length < 27 || bytes[0] !== 0x4f || bytes[1] !== 0x67 || bytes[2] !== 0x67 || bytes[3] !== 0x53) return null;
  for (let i = bytes.length - 27; i >= 0; i--) {
    if (bytes[i] === 0x4f && bytes[i + 1] === 0x67 && bytes[i + 2] === 0x67 && bytes[i + 3] === 0x53 && bytes[i + 4] === 0) {
      let granulo = 0;
      for (let b = 7; b >= 0; b--) granulo = granulo * 256 + bytes[i + 6 + b]!;
      // Página sem posição (-1): procura a anterior.
      if (granulo >= 2 ** 63 - 1 || granulo <= 0) continue;
      return Math.max(1, Math.ceil(granulo / 48_000));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Pedidos das rotas.

export const decidirSugestaoSchema = z.object({
  versao,
  /** Usar a sugestão: preenche os três campos; um campo dado troca só ele. */
  usar: z.boolean(),
  categoriaId: id.nullable().optional().transform((v) => v ?? null),
  prioridadeId: id.nullable().optional().transform((v) => v ?? null),
  local: z.string().trim().max(120).nullable().optional().transform((v) => (v ? v : null)),
});
export type DecidirSugestao = z.infer<typeof decidirSugestaoSchema>;

export const sugestaoRegistroSchema = z.object({
  assunto: z.string().trim().max(120).optional().default(""),
  relato: z.string().trim().min(15, "Escreva o relato antes").max(4000),
  local: z.string().trim().max(120).optional().default(""),
  unidadeId: id.nullable().optional().transform((v) => v ?? null),
});
export type SugestaoRegistro = z.infer<typeof sugestaoRegistroSchema>;

export const ajudaIaSchema = z.object({ versao, sugerir: z.boolean(), transcrever: z.boolean() });
export type AjudaIa = z.infer<typeof ajudaIaSchema>;

export const chaveIaSchema = z
  .object({ versao, ligada: z.boolean(), motivo: z.string().trim().max(300).optional().default("") })
  .superRefine((d, ctx) => {
    if (!d.ligada && d.motivo.length < 3) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Diga o motivo" });
  });
export type ChaveIa = z.infer<typeof chaveIaSchema>;

export const limitesIaSchema = z.object({
  versao,
  limiteSugestoes: z.number().int().min(0).max(100_000),
  limiteMinutos: z.number().int().min(0).max(100_000),
});
export type LimitesIa = z.infer<typeof limitesIaSchema>;

// ---------------------------------------------------------------------------------------
// Textos curtos que a tela e o histórico usam.

/** "2026-11-01" → "01/11". */
export function diaDeRenovar(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}` : "o mês virar";
}

/** O resumo da linha em Configurações (sem valores). */
export function resumoAjudaIa(a: {
  ligadaTriade: boolean;
  sugerir: { ligada: boolean };
  transcrever: { ligada: boolean };
  uso: { sugestoes: { usadas: number; limite: number } };
}): string {
  if (!a.ligadaTriade) return "Desligada pela TRÍADE";
  const ligadas = [a.sugerir.ligada && "Sugestão", a.transcrever.ligada && "transcrição"].filter(Boolean) as string[];
  const quais = ligadas.length === 2 ? "Sugestão e transcrição ligadas" : ligadas.length === 1 ? `${ligadas[0] === "Sugestão" ? "Sugestão" : "Transcrição"} ligada` : "Tudo desligado";
  return `${quais} · ${a.uso.sugestoes.usadas} de ${a.uso.sugestoes.limite} sugestões no mês`;
}

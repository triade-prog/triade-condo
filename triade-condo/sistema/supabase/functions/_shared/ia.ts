// Motor de IA com freio (IA-20): o resto do sistema fala só com o ConectorIa e o
// ConectorTranscricao. Trocar de provedor é escrever outro conector; o banco guarda só o nome do
// provedor e do modelo, e a chave fica no segredo da função (ANTHROPIC_API_KEY). Sem a chave, o
// conector não existe e a sugestão fica indisponível: o pedido segue como sempre.
//
// Nada aqui registra o texto, a resposta ou a chave: o registro da chamada (NG-13) leva só função,
// modelo, tamanho, custo e resultado.

import Anthropic from "@anthropic-ai/sdk";
import {
  custoSugestaoMicros,
  custoTranscricaoMicros,
  type EntradaSugestao,
  formatoRespostaSugestao,
  INSTRUCOES_SUGESTAO,
  interpretarSugestaoIa,
  mensagemSugestao,
  type SugestaoInterpretada,
} from "@triade/domain";

/** O que volta de uma chamada: sempre com o que foi gasto, para o registro. */
export interface ResultadoChamadaIa {
  ok: boolean;
  provedor: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoMicros: number;
  moeda: "USD" | "BRL";
  /** Por que falhou, em uma palavra (para o registro, sem conteúdo). */
  falha?: "LIMITE_PROVEDOR" | "REDE" | "PROVEDOR" | "FORMATO";
}

export type ResultadoSugestao = ResultadoChamadaIa & { sugestao: SugestaoInterpretada | null };

export interface ConectorIa {
  readonly provedor: string;
  sugerir(modelo: string, entrada: EntradaSugestao): Promise<ResultadoSugestao>;
}

export interface ResultadoTranscricao {
  ok: boolean;
  provedor: string;
  modelo: string;
  segundos: number;
  custoMicros: number;
  moeda: "USD" | "BRL";
  texto: string;
}

export interface ConectorTranscricao {
  readonly provedor: string;
  transcrever(audio: Uint8Array, tipo: string, segundos: number | null): Promise<ResultadoTranscricao>;
}

// ---------------------------------------------------------------------------------------
// Provedor de teste: determinístico, por palavras do relato. Serve aos testes e ao ambiente
// local; nunca sai da máquina.

const PALAVRAS: { termos: RegExp; categoria: RegExp; prioridade: RegExp; porque: string }[] = [
  { termos: /vaz|infiltra|goteir|cano|água/i, categoria: /manuten/i, prioridade: /urgen/i, porque: "O relato fala em vazamento de água." },
  { termos: /sujeir|lixo|limpe/i, categoria: /limpez/i, prioridade: /normal/i, porque: "O relato fala em sujeira ou lixo." },
  { termos: /barulh|som alto|festa/i, categoria: /barulh|conviv/i, prioridade: /normal/i, porque: "O relato fala em barulho." },
  { termos: /lâmpad|luz|tomad|elétric|portão/i, categoria: /manuten/i, prioridade: /normal/i, porque: "O relato fala em um conserto." },
];
const LOCAIS = /\b(banheiro social|banheiro|cozinha|garagem|hall|portaria|piscina|salão de festas|elevador|portão)\b/i;

export function conectorIaTeste(): ConectorIa {
  return {
    provedor: "TESTE",
    sugerir(modelo, e) {
      const base: ResultadoChamadaIa = {
        ok: true, provedor: "TESTE", modelo, tokensEntrada: Math.ceil(e.texto.length / 4) + 200, tokensSaida: 60, custoMicros: 0, moeda: "USD",
      };
      const regra = e.texto.length >= 15 ? PALAVRAS.find((p) => p.termos.test(e.texto)) : undefined;
      const categoria = regra && e.categorias.find((c) => regra.categoria.test(c.nome));
      const prioridade = regra && (e.prioridades.find((p) => regra.prioridade.test(p.nome)) ?? e.prioridades[0]);
      if (!regra || !categoria || !prioridade) {
        return Promise.resolve({ ...base, sugestao: { categoriaId: e.categorias[0]?.id ?? "", prioridadeId: e.prioridades[0]?.id ?? "", local: null, porque: null, confianca: "BAIXA" } });
      }
      const local = LOCAIS.exec(e.texto)?.[1] ?? null;
      return Promise.resolve({
        ...base,
        sugestao: { categoriaId: categoria.id, prioridadeId: prioridade.id, local: local && local[0]!.toUpperCase() + local.slice(1).toLowerCase(), porque: regra.porque, confianca: "ALTA" },
      });
    },
  };
}

export function conectorTranscricaoTeste(): ConectorTranscricao {
  return {
    provedor: "TESTE",
    transcrever(audio, _tipo, segundos) {
      const s = segundos ?? Math.max(1, Math.ceil(audio.length / 4000));
      return Promise.resolve({
        ok: true, provedor: "TESTE", modelo: "teste-1", segundos: s, custoMicros: custoTranscricaoMicros(s), moeda: "USD",
        texto: audio.length < 10 ? "" : "Transcrição de teste do áudio recebido.",
      });
    },
  };
}

// ---------------------------------------------------------------------------------------
// Anthropic (modelo pequeno, saída em JSON com formato fixo, validada no domínio).

/** O pedaço do SDK que usamos: deixa o teste trocar o cliente sem rede. */
export interface ClienteMensagens {
  messages: { create(p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

export function conectorAnthropic(apiKey: string, cliente?: ClienteMensagens): ConectorIa {
  const c: ClienteMensagens = cliente ?? new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
  return {
    provedor: "ANTHROPIC",
    async sugerir(modelo, e) {
      const vazio = { ok: false, provedor: "ANTHROPIC", modelo, tokensEntrada: 0, tokensSaida: 0, custoMicros: 0, moeda: "USD" as const, sugestao: null };
      let r: Anthropic.Message;
      try {
        r = await c.messages.create({
          model: modelo,
          max_tokens: 1024,
          output_config: { effort: "low", format: { type: "json_schema", schema: formatoRespostaSugestao(e) } },
          system: INSTRUCOES_SUGESTAO,
          messages: [{ role: "user", content: mensagemSugestao(e) }],
        });
      } catch (erro) {
        // A ordem importa: conexão antes do erro geral da API.
        if (erro instanceof Anthropic.RateLimitError) return { ...vazio, falha: "LIMITE_PROVEDOR" };
        if (erro instanceof Anthropic.APIConnectionError) return { ...vazio, falha: "REDE" };
        return { ...vazio, falha: "PROVEDOR" };
      }
      const tokensEntrada = r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0);
      const tokensSaida = r.usage.output_tokens;
      const gasto = { provedor: "ANTHROPIC", modelo, tokensEntrada, tokensSaida, custoMicros: custoSugestaoMicros(modelo, tokensEntrada, tokensSaida), moeda: "USD" as const };
      if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") return { ...gasto, ok: false, falha: "FORMATO", sugestao: null };
      const texto = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      const sugestao = interpretarSugestaoIa(texto, e);
      // Resposta fora do formato: a chamada foi feita e conta; fica sem sugestão.
      return { ...gasto, ok: true, sugestao: sugestao ?? null };
    },
  };
}

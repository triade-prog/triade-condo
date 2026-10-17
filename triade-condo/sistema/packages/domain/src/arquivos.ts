// Fotos e documentos dos pedidos (passo 4b; F4.8, PT-07). Os mesmos limites estão no banco
// (0100_arquivos_pedido.sql) e no armazenamento privado do Supabase (bucket "pedidos").

import { z } from "zod";

/** Tipos aceitos: fotos e PDF. Vídeo e áudio do morador chegam com o WhatsApp (passo 5). */
export const TIPOS_ARQUIVO = {
  "image/jpeg": "Foto",
  "image/png": "Foto",
  "image/webp": "Foto",
  "application/pdf": "PDF",
} as const;
export type TipoArquivo = keyof typeof TIPOS_ARQUIVO;

export const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;
export const ARQUIVOS_POR_PEDIDO = 30;
export const ARQUIVOS_POR_ENVIO = 10;
/** Quanto tempo vale o link de abrir ou baixar. */
export const VALIDADE_LINK_ARQUIVO_S = 300;

/** De que parte do pedido é o arquivo. */
export const PARTES_ARQUIVO = {
  RELATO: "Relato",
  ANDAMENTO: "Andamento",
  CONCLUSAO: "Conclusão",
} as const;
export type ParteArquivo = keyof typeof PARTES_ARQUIVO;

export const SITUACOES_ARQUIVO = {
  ENVIANDO: "Verificando",
  LIBERADO: "Liberado",
  NAO_LIBERADO: "Não liberado",
} as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const enviarArquivoSchema = z.object({
  parte: z.enum(chaves(PARTES_ARQUIVO)),
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(300).nullable().optional().transform((v) => (v ? v : null)),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});
export const tirarArquivoSchema = z.object({ motivo: z.string().trim().min(3).max(500) });

/** Tamanho para mostrar: "340 KB", "2,1 MB". */
export function mostrarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * O que dá para conferir no navegador antes de enviar, para dizer o motivo na hora. O servidor
 * confere de novo e confere o conteúdo de verdade depois do envio.
 */
export function conferirAntesDeEnviar(arquivo: { name: string; type: string; size: number }): string | null {
  if (!(arquivo.type in TIPOS_ARQUIVO)) {
    return /^(video|audio)\//.test(arquivo.type)
      ? "não foi aceito: só fotos e PDF. Vídeo e áudio chegam com o WhatsApp (passo 5)."
      : "não foi aceito: só fotos (JPG, PNG, WEBP) e PDF.";
  }
  if (arquivo.size < 1) return "está vazio.";
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    return `passa de 10 MB (${mostrarTamanho(arquivo.size)}). Diminua o arquivo ou envie as páginas que importam.`;
  }
  return null;
}

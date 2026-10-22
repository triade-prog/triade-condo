// Mural visto do painel e o mural em feed e vitrine (CD-15; CD-12, AC-05). Os motivos são os
// mesmos do banco (0285_mural_no_painel.sql).

import { reais, TIPOS_ANUNCIO, type TipoAnuncio } from "./vida.ts";

/** De quanto em quanto tempo a prévia do mural confere de novo, com a tela aberta. */
export const MURAL_CONFERIR_S = 30;

/** Por que um comunicado publicado não aparece no link do mural. */
export const MOTIVOS_FORA_DO_MURAL = {
  SO_PARA_ALGUNS: "É só para um bloco, unidade ou contatos. Só comunicado para todo o condomínio vai ao mural.",
  ASSUNTO_FORA: "O assunto começa fora do mural.",
  TIRADO: "Foi tirado do mural.",
} as const;
export type MotivoForaDoMural = keyof typeof MOTIVOS_FORA_DO_MURAL;

/** A linha grande do anúncio na vitrine: o valor, "Grátis" na doação, senão o tipo. */
export function precoDoAnuncio(a: { tipo: TipoAnuncio; valorCentavos?: number | null }): string {
  if (a.valorCentavos) return reais(a.valorCentavos);
  if (a.tipo === "DOO") return "Grátis";
  return TIPOS_ANUNCIO[a.tipo];
}

const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "hoje", "ontem", "há 3 dias", "há 1 semana", "há 2 semanas", "há 1 mês", contando dias no fuso de Brasília. */
export function haQuanto(desde: string, agora: Date = new Date()): string {
  const dias = Math.round((Date.parse(DIA.format(agora)) - Date.parse(DIA.format(new Date(desde)))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) {
    const s = Math.floor(dias / 7);
    return s === 1 ? "há 1 semana" : `há ${s} semanas`;
  }
  const m = Math.floor(dias / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

/** "Conferido agora", "Conferido há 12 s", "Conferido há 3 min". */
export function textoConferido(em: number, agora: number = Date.now()): string {
  const s = Math.max(0, Math.round((agora - em) / 1000));
  if (s < 5) return "Conferido agora";
  if (s < 60) return `Conferido há ${s} s`;
  return `Conferido há ${Math.floor(s / 60)} min`;
}

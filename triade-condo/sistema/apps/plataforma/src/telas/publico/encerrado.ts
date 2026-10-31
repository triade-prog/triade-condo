// O contrato do condomínio terminou (R17.7c, 0318; quadro 489; decisão F1): depois do último dia,
// todo link público (mural, etiqueta, comunicado, documento, cadastro, enquete, assembleia,
// conselho, orçamento e prestador) recusa com o motivo CONTRATO_ENCERRADO, e o detalhe traz o nome
// do condomínio e o dia em que saiu do ar. Aqui só se lê a recusa e se escreve a frase.

import { mostrarDataSemHora } from "@triade/domain";

export interface Encerramento {
  /** O nome do condomínio; vazio se a recusa não trouxe. */
  condominio: string;
  /** O dia seguinte ao último dia (YYYY-MM-DD), quando veio. */
  desde?: string;
}

/**
 * A recusa (ou a resposta) diz que o contrato terminou? Aceita o erro da API, com o motivo no
 * detalhe, ou um objeto com o motivo direto (por exemplo, o link do prestador encerrado).
 */
export function encerramentoDe(x: { codigo?: unknown; detalhes?: Record<string, unknown> } | Record<string, unknown> | null | undefined): Encerramento | null {
  if (!x) return null;
  const d = ("codigo" in x ? x.detalhes : x) as Record<string, unknown> | undefined;
  if (!d || d.motivo !== "CONTRATO_ENCERRADO") return null;
  return {
    condominio: typeof d.condominio === "string" ? d.condominio.trim() : "",
    desde: typeof d.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.desde) ? d.desde : undefined,
  };
}

/** "Mural do Edifício Ipiranga", ou só "Mural" sem o nome. */
export const subtituloEncerrado = (rotulo: string, e: Encerramento, ligacao = "do") => (e.condominio ? `${rotulo} ${ligacao} ${e.condominio}` : rotulo);

/** "O mural e os links do Edifício Ipiranga saíram do ar em 24/11/2026." */
export function textoForaDoAr(e: Encerramento): string {
  return `O mural e os links ${e.condominio ? `do ${e.condominio}` : "do condomínio"} saíram do ar${e.desde ? ` em ${mostrarDataSemHora(e.desde)}` : ""}.`;
}

// O cartão Vencimentos do Início (DC15, telas-modelo documentos-memoria-*; canvas do novo
// frontend, quadro 100; MP-05, MP-12): cada linha diz qual é o item do prontuário e abre o item.
// Até três linhas, das mais urgentes; o resto vira "e mais", que abre o prontuário. O documento
// ligado a um item entra uma vez só, como item. Sem a lista do prontuário (carregando ou com
// erro), ficam as contagens.

import { GRUPOS_PRONTUARIO, mostrarDataCurta } from "@triade/domain";
import type { LinhaInicio } from "../CartaoInicio.tsx";
import type { ItemProntuario, Prontuario, ResumoProntuario } from "../tipos.ts";
import { ICONE_GRUPO, textoSelo } from "./Prontuario.tsx";

export const MAXIMO_VENCIMENTOS = 3;

export function linhasProntuario(r: ResumoProntuario): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  const linha = (icone: LinhaInicio["icone"], tom: LinhaInicio["tom"], titulo: string, href: string) =>
    linhas.push({ icone, tom, titulo, detalhe: "Prontuário de Documentos e memória", href, rotuloBotao: `Ver: ${titulo}` });
  if (r.venceu) linha("alerta", "erro", r.venceu === 1 ? "1 item do prontuário venceu" : `${r.venceu} itens do prontuário venceram`, "/documentos/prontuario?ver=VENCE");
  if (r.vence) linha("relogio", "atencao", r.vence === 1 ? "1 item vence logo" : `${r.vence} itens vencem logo`, "/documentos/prontuario?ver=VENCE");
  if (r.falta) linha("documento", "violeta", r.falta === 1 ? "1 item falta no prontuário" : `${r.falta} itens faltam no prontuário`, "/documentos/prontuario?ver=FALTA");
  return linhas;
}

/** O item que venceu ou vence logo, pelo nome; abre o item. */
export function linhaItem(i: ItemProntuario): LinhaInicio {
  const chave = i.id ?? i.chave!;
  const titulo = `${i.nome} ${textoSelo(i).replace(/^./, (c) => c.toLowerCase())}`;
  return {
    chave, icone: ICONE_GRUPO[i.grupo], tom: i.situacao === "VENCEU" ? "erro" : "atencao", titulo,
    detalhe: i.situacao === "VENCE" && i.valeAte ? `Prontuário · até ${mostrarDataCurta(i.valeAte)}` : `Prontuário · ${GRUPOS_PRONTUARIO[i.grupo]}`,
    href: `/documentos/prontuario?item=${encodeURIComponent(chave)}`, botao: "Abrir", rotuloBotao: `Abrir: ${i.nome}`,
  };
}

/** Os itens que venceram e os que vencem logo, do mais urgente ao menos. */
export function itensVencendo(p: Prontuario): ItemProntuario[] {
  return p.itens.filter((i) => i.situacao === "VENCEU" || i.situacao === "VENCE")
    .sort((a, b) => Number(b.situacao === "VENCEU") - Number(a.situacao === "VENCEU") || (a.valeAte ?? "").localeCompare(b.valeAte ?? ""));
}

/** Um documento entra em Vencimentos só se não estiver ligado a um item do prontuário. */
export const documentoNoProntuario = (p: Prontuario, documentoId: string | undefined) => !!documentoId && p.itens.some((i) => i.documento?.id === documentoId);

/** "e mais 6 itens que faltam no prontuário": o que passou das três linhas e o que falta. */
export function maisVencimentos(resto: number, falta: number): { texto: string; href: string } | null {
  if (!resto && !falta) return null;
  const faltam = falta === 1 ? "1 item que falta no prontuário" : `${falta} itens que faltam no prontuário`;
  if (!resto) return { texto: `e mais ${faltam}`, href: "/documentos/prontuario?ver=FALTA" };
  const vencendo = resto === 1 ? "1 vencendo" : `${resto} vencendo`;
  return { texto: falta ? `e mais ${vencendo} e ${faltam}` : `e mais ${vencendo}`, href: falta ? "/documentos/prontuario" : "/documentos/prontuario?ver=VENCE" };
}

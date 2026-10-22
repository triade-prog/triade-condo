// As linhas dos Comunicados e documentos no Início (design "Telas dos Comunicados", tela 6, no
// padrão novo da DC15; CD-06, MP-12): o que sai hoje e o rascunho parado. O documento perto de
// vencer vai para o cartão Vencimentos.

import { descreverValidade } from "@triade/domain";
import type { LinhaInicio } from "../CartaoInicio.tsx";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import type { ResumoComunicados } from "../tipos.ts";

export function linhasComunicados(r: ResumoComunicados): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  if (r.programadosHoje) {
    const titulo = r.programadosHoje === 1 ? "1 programado para hoje" : `${r.programadosHoje} programados para hoje`;
    linhas.push({ icone: "relogio", tom: "violeta", titulo, detalhe: r.proximoProgramado ? `${r.proximoProgramado.titulo} · ${diaHora(r.proximoProgramado.em)}` : undefined,
      href: "/comunicados?atencao=PROGRAMADOS_HOJE", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.rascunhosParados) {
    const titulo = r.rascunhosParados === 1 ? "1 rascunho parado há mais de 3 dias" : `${r.rascunhosParados} rascunhos parados há mais de 3 dias`;
    linhas.push({ icone: "editar", tom: "atencao", titulo, detalhe: r.rascunhoMaisAntigo?.titulo, href: "/comunicados?atencao=RASCUNHOS_PARADOS", rotuloBotao: `Ver: ${titulo}` });
  }
  return linhas;
}

/** O documento mais perto de vencer, para o cartão Vencimentos. */
export function linhaDocumento(r: ResumoComunicados): LinhaInicio | null {
  if (!r.documentosVencendo) return null;
  const titulo = r.documentoMaisProximo ? `${r.documentoMaisProximo.titulo} ${descreverValidade(r.documentoMaisProximo.valeAte, hojeEmBrasilia())}` : "Documento perto de vencer";
  return { icone: "escudo", tom: "atencao", titulo,
    detalhe: r.documentosVencendo === 1 ? "1 documento vence em até 60 dias" : `${r.documentosVencendo} documentos vencem em até 60 dias`,
    href: "/documentos?filtro=VENCENDO", rotuloBotao: `Ver: ${titulo}` };
}

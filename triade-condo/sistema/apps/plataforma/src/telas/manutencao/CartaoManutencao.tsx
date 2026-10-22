// As linhas da Manutenção no Início (design "Telas da Manutenção", tela 7, no padrão novo da
// DC15; MP-01, MP-03): retorno vencido e preventiva atrasada, cada uma levando à lista. O
// contrato perto do fim (MP-05) vai para o cartão Vencimentos.

import { mostrarDataCurta } from "@triade/domain";
import type { LinhaInicio } from "../CartaoInicio.tsx";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import type { ResumoManutencao } from "../tipos.ts";

export function linhasManutencao(r: ResumoManutencao): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  if (r.retornoVencido) {
    const titulo = r.retornoVencido === 1 ? "1 retorno vencido" : `${r.retornoVencido} retornos vencidos`;
    linhas.push({ icone: "relogio", tom: "erro", titulo, detalhe: r.vencidaMaisAntiga ? `${r.vencidaMaisAntiga.titulo} · desde ${diaHora(r.vencidaMaisAntiga.desde)}` : undefined,
      href: "/manutencao?atencao=RETORNO_VENCIDO", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.preventivasAtrasadas) {
    const titulo = r.preventivasAtrasadas === 1 ? "1 preventiva atrasada" : `${r.preventivasAtrasadas} preventivas atrasadas`;
    linhas.push({ icone: "trocar", tom: "atencao", titulo, detalhe: r.atrasadaMaisAntiga ? `${r.atrasadaMaisAntiga.titulo} · era em ${mostrarDataCurta(r.atrasadaMaisAntiga.data)}` : undefined,
      href: "/manutencao?tipo=PREVENTIVA", rotuloBotao: `Ver: ${titulo}` });
  }
  return linhas;
}

/** O contrato que vence em 60 dias, para o cartão Vencimentos. */
export function linhaContrato(r: ResumoManutencao): LinhaInicio | null {
  if (!r.contratosAVencer) return null;
  const c = r.contratoMaisProximo;
  if (!c) {
    const titulo = r.contratosAVencer === 1 ? "1 contrato vence em 60 dias" : `${r.contratosAVencer} contratos vencem em 60 dias`;
    return { icone: "ferramenta", tom: "atencao", titulo, href: "/documentos?filtro=CONTRATOS", rotuloBotao: `Ver: ${titulo}` };
  }
  const dias = Math.round((Date.parse(`${c.ate}T12:00:00Z`) - Date.parse(`${hojeEmBrasilia()}T12:00:00Z`)) / 86_400_000);
  const titulo = `Contrato da ${c.nome} ${dias <= 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`}`;
  const outros = r.contratosAVencer - 1;
  return { icone: "ferramenta", tom: "atencao", titulo,
    detalhe: `Prestador · até ${mostrarDataCurta(c.ate)}${outros ? ` · e mais ${outros} em 60 dias` : ""}`,
    href: `/manutencao/prestador?id=${c.id}`, botao: "Abrir", rotuloBotao: `Abrir: contrato da ${c.nome}` };
}

export function vazioManutencao(r: ResumoManutencao): string {
  return r.abertas ? `${r.abertas === 1 ? "1 manutenção aberta" : `${r.abertas} manutenções abertas`}, nada atrasado.` : "Nada aberto na manutenção.";
}

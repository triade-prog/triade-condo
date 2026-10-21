// As linhas da Manutenção no Início (design "Telas da Manutenção", tela 7, no padrão novo da
// DC15; MP-01, MP-03): retorno vencido e preventiva atrasada, cada uma levando à lista. O
// contrato perto do fim (MP-05) vai para o cartão Vencimentos.

import { mostrarDataCurta } from "@triade/domain";
import type { LinhaInicio } from "../CartaoInicio.tsx";
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
  const titulo = r.contratosAVencer === 1 ? "1 contrato vence em 60 dias" : `${r.contratosAVencer} contratos vencem em 60 dias`;
  return { icone: "documento", tom: "violeta", titulo, detalhe: r.contratoMaisProximo ? `${r.contratoMaisProximo.nome} · ${mostrarDataCurta(r.contratoMaisProximo.ate)}` : undefined,
    href: "/manutencao/prestadores", rotuloBotao: `Ver: ${titulo}` };
}

export function vazioManutencao(r: ResumoManutencao): string {
  return r.abertas ? `${r.abertas === 1 ? "1 manutenção aberta" : `${r.abertas} manutenções abertas`}, nada atrasado.` : "Nada aberto na manutenção.";
}

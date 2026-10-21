// As linhas do prontuário da Memória do prédio no Início (design "Memória do prédio", tela 1, no
// padrão novo da DC15; MP-12): o que venceu, o que vence logo e o que falta, no cartão Vencimentos.

import type { LinhaInicio } from "../CartaoInicio.tsx";
import type { ResumoProntuario } from "../tipos.ts";

export function linhasProntuario(r: ResumoProntuario): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  const linha = (icone: LinhaInicio["icone"], tom: LinhaInicio["tom"], titulo: string) =>
    linhas.push({ icone, tom, titulo, detalhe: "Prontuário da Memória do prédio", href: "/memoria", rotuloBotao: `Ver: ${titulo}` });
  if (r.venceu) linha("alerta", "erro", r.venceu === 1 ? "1 item do prontuário venceu" : `${r.venceu} itens do prontuário venceram`);
  if (r.vence) linha("relogio", "atencao", r.vence === 1 ? "1 item vence logo" : `${r.vence} itens vencem logo`);
  if (r.falta) linha("documento", "violeta", r.falta === 1 ? "1 item falta no prontuário" : `${r.falta} itens faltam no prontuário`);
  return linhas;
}

// As linhas da Vida em condomínio no Início (design "Vida em condomínio", tela 10, no padrão novo
// da DC15; AC-01): só aparece quando há algo a fazer ou acompanhar: reservas esperando aprovação,
// enquetes abertas (AC-03), a próxima assembleia (AC-02) e anúncios a aprovar (AC-05).

import { ESTADOS_ASSEMBLEIA, formatarDataHora, textoRespostas } from "@triade/domain";
import type { LinhaInicio } from "../CartaoInicio.tsx";
import type { ResumoVida } from "../tipos.ts";
import { diaCurto } from "./comum.tsx";
import { prazoCurto } from "./Enquetes.tsx";

export const temVida = (r?: ResumoVida) => !!(r && (r.reservasAAprovar || r.enquetesAbertas?.length || r.assembleia || r.classificadosAAprovar));

export function linhasVida(r: ResumoVida): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  if (r.reservasAAprovar) {
    linhas.push({ icone: "calendario", tom: "atencao", titulo: r.reservasAAprovar === 1 ? "1 reserva a aprovar" : `${r.reservasAAprovar} reservas a aprovar`,
      detalhe: r.proximasAAprovar.map((p) => `${diaCurto(p.data)} · ${p.area}${p.pedidos > 1 ? ` · ${p.pedidos} pedidos para o mesmo dia` : ""}`).join("; "),
      href: "/vida", rotuloBotao: "Ver as reservas a aprovar" });
  }
  if (r.classificadosAAprovar) {
    linhas.push({ icone: "megafone", tom: "atencao", titulo: r.classificadosAAprovar === 1 ? "1 anúncio a aprovar" : `${r.classificadosAAprovar} anúncios a aprovar`,
      detalhe: "Classificados entre moradores, para o mural", href: "/vida?aba=classificados", rotuloBotao: "Ver os anúncios a aprovar" });
  }
  for (const e of r.enquetesAbertas ?? []) {
    linhas.push({ chave: e.id, icone: "grafico", tom: "andamento", titulo: `Enquete: ${e.pergunta}`, detalhe: `${textoRespostas(e.responderam, e.total)} · fecha ${prazoCurto(e.abertaAte)}`,
      href: "/vida?aba=enquetes", rotuloBotao: `Ver a enquete: ${e.pergunta}` });
  }
  if (r.assembleia) {
    const a = r.assembleia;
    linhas.push({ icone: "convivio", tom: "neutro", titulo: `Assembleia: ${a.titulo}`,
      detalhe: `${a.estado === "EM_ANDAMENTO" ? ESTADOS_ASSEMBLEIA.EM_ANDAMENTO : `1ª chamada em ${formatarDataHora(a.primeiraChamada)}`}${a.procuracoesPendentes ? ` · ${a.procuracoesPendentes === 1 ? "1 procuração" : `${a.procuracoesPendentes} procurações`} a conferir` : ""}`,
      href: `/vida/assembleia?id=${a.id}`, rotuloBotao: `Ver a assembleia: ${a.titulo}` });
  }
  return linhas;
}

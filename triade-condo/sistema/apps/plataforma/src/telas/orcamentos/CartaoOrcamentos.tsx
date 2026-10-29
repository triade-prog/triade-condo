// Orçamentos no Início (R8, quadro 470): só quando algum pede atenção. Cada linha leva à lista.
import type { LinhaInicio } from "../CartaoInicio.tsx";
import type { Painel } from "../sessao.tsx";

export function linhasOrcamentos(r: NonNullable<Painel["orcamentos"]>): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  if (r.pedeAtencao) {
    const titulo = r.pedeAtencao === 1 ? "1 orçamento pede atenção" : `${r.pedeAtencao} orçamentos pedem atenção`;
    linhas.push({ icone: "alerta", tom: "atencao", titulo, detalhe: "Prazo que fechou, proposta vencida ou aceite atrasado", href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.paraDecidir) {
    const titulo = r.paraDecidir === 1 ? "1 pronto para decidir" : `${r.paraDecidir} prontos para decidir`;
    linhas.push({ icone: "carrinho", tom: "violeta", titulo, href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.emAndamento) {
    const titulo = r.emAndamento === 1 ? "1 orçamento em andamento" : `${r.emAndamento} orçamentos em andamento`;
    linhas.push({ icone: "relogio", tom: "neutro", titulo, href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  return linhas;
}

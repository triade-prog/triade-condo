// Orçamentos no Início (R8, quadro 470): só quando algum pede atenção. Cada linha leva à lista.
import type { LinhaInicio } from "../CartaoInicio.tsx";
import type { Painel } from "../sessao.tsx";

export function linhasOrcamentos(r: NonNullable<Painel["orcamentos"]>): LinhaInicio[] {
  const linhas: LinhaInicio[] = [];
  if (r.pedeAtencao) {
    const titulo = r.pedeAtencao === 1 ? "1 orçamento pede atenção" : `${r.pedeAtencao} orçamentos pedem atenção`;
    linhas.push({ icone: "alerta", tom: "atencao", titulo, detalhe: "Prazo que fechou, proposta vencida ou aceite atrasado", href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.comparar) {
    const titulo = r.comparar === 1 ? "1 pronto para comparar" : `${r.comparar} prontos para comparar`;
    linhas.push({ icone: "carrinho", tom: "violeta", titulo, href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  if (r.pedindo) {
    const titulo = r.pedindo === 1 ? "1 pedindo propostas" : `${r.pedindo} pedindo propostas`;
    linhas.push({ icone: "relogio", tom: "neutro", titulo, href: "/orcamentos", rotuloBotao: `Ver: ${titulo}` });
  }
  return linhas;
}

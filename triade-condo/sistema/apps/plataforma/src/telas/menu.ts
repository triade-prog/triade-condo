// Menu da Plataforma do síndico (DC15, docs/design/telas-modelo/moldura-computador.html): o Início
// e quatro grupos por tarefa. Cada item diz quem vê, quando está escolhido, a contagem do que
// pede atenção e, para quem não vê, qual permissão falta (o estado "sem permissão").

import { PERMISSOES } from "@triade/domain";
import type { NomeIcone } from "@triade/ui";
import type { Painel } from "./sessao.tsx";

export type GrupoMenu = "Dia a dia" | "Comunicação" | "Prédio e pessoas" | "Gestão";

export interface ItemDoMenu {
  href: string;
  texto: string;
  icone: NomeIcone;
  grupo: GrupoMenu | null;
  /** Quem vê o item. */
  ve: (pode: (acao: string) => boolean, painel: Painel) => boolean;
  /** Os caminhos do item: o mais comprido que casar com a tela é o escolhido. */
  caminhos: string[];
  /** O que pede atenção, com o nome por extenso para quem usa leitor de tela. */
  contagem?: (painel: Painel) => { n: number; nome: string } | null;
  /** Para quem não vê: a permissão que falta. Sem ela, a parte é só do síndico. */
  permissao?: string;
  /** Some sem dizer "sem permissão": o item depende de algo que não é permissão. */
  semGuarda?: boolean;
  /** Fica na barra de baixo do celular. */
  atalho?: boolean;
}

const conta = (n: number | undefined, nome: string) => (n ? { n, nome } : null);

export const ITENS_MENU: ItemDoMenu[] = [
  { href: "/", texto: "Início", icone: "casa", grupo: null, ve: () => true, caminhos: [], atalho: true },

  { href: "/pedidos", texto: "Pedidos", icone: "pedido", grupo: "Dia a dia", ve: (p) => p("pedidos.ver"), caminhos: ["/pedidos"],
    contagem: (d) => conta(d.pedidos?.retornoVencido, "com retorno vencido"), permissao: PERMISSOES.ACOMPANHAR, atalho: true },
  { href: "/decisoes", texto: "Decisões", icone: "decisao", grupo: "Dia a dia", ve: (p) => p("decisoes.aprovar") || p("pedidos.atualizar"), caminhos: ["/decisoes"],
    contagem: (d) => conta(d.decisoes?.aguardando, "aguardando você"), permissao: PERMISSOES.APROVAR },
  { href: "/agenda", texto: "Agenda", icone: "calendario", grupo: "Dia a dia", ve: (p) => p("agenda.ver"), caminhos: ["/agenda"],
    permissao: PERMISSOES.VER_AGENDA, atalho: true },
  { href: "/manutencao", texto: "Manutenção", icone: "ferramenta", grupo: "Dia a dia", ve: (p) => p("manutencao.ver"), caminhos: ["/manutencao"],
    contagem: (d) => conta(d.manutencao?.retornoVencido, "com retorno vencido"), permissao: PERMISSOES.VER_MANUTENCAO },

  { href: "/comunicados", texto: "Comunicados", icone: "megafone", grupo: "Comunicação", ve: (p) => p("comunicados.ver"), caminhos: ["/comunicados"],
    permissao: PERMISSOES.VER_COMUNICADOS },
  { href: "/whatsapp", texto: "WhatsApp", icone: "whats", grupo: "Comunicação", ve: (_, d) => !!d.whatsapp && d.whatsapp.situacao !== "SEM_CREDENCIAIS",
    caminhos: ["/whatsapp"], contagem: (d) => conta(d.whatsapp ? d.whatsapp.aIdentificar + d.whatsapp.falhas : 0, "para ver"), semGuarda: true, atalho: true },
  { href: "/vida", texto: "Vida em condomínio", icone: "convivio", grupo: "Comunicação",
    ve: (p) => p("reservas.ver") || p("enquetes.ver") || p("assembleias.ver") || p("classificados.ver"), caminhos: ["/vida"],
    contagem: (d) => conta((d.vida?.reservasAAprovar ?? 0) + (d.vida?.classificadosAAprovar ?? 0), "a aprovar"), permissao: PERMISSOES.VER_RESERVAS },

  { href: "/moradores", texto: "Moradores e unidades", icone: "predio", grupo: "Prédio e pessoas", ve: (p) => p("moradores.ver"), caminhos: ["/moradores"],
    permissao: PERMISSOES.CADASTRAR },
  { href: "/comunicados/documentos", texto: "Documentos e memória", icone: "documento", grupo: "Prédio e pessoas", ve: (p) => p("documentos.ver"),
    caminhos: ["/comunicados/documento", "/memoria"], permissao: PERMISSOES.VER_COMUNICADOS },
  { href: "/indicadores", texto: "Indicadores", icone: "grafico", grupo: "Prédio e pessoas", ve: (p) => p("pedidos.ver"), caminhos: ["/indicadores"],
    permissao: PERMISSOES.ACOMPANHAR },

  { href: "/configuracoes", texto: "Configurações", icone: "ajuste", grupo: "Gestão", ve: (p) => p("config.ver"), caminhos: ["/configuracoes"] },
  { href: "/pessoas", texto: "Pessoas e acesso", icone: "pessoas", grupo: "Gestão", ve: (p) => p("pessoas.ver"), caminhos: ["/pessoas"] },
  { href: "/suporte", texto: "Ajuda e suporte", icone: "balao", grupo: "Gestão", ve: (p) => p("suporte.chamados"), caminhos: ["/suporte"] },
];

export const GRUPOS_MENU: GrupoMenu[] = ["Dia a dia", "Comunicação", "Prédio e pessoas", "Gestão"];

/** O item da tela aberta: o caminho mais comprido que casar. O Início só casa com "/". */
export function itemDoCaminho(caminho: string): ItemDoMenu | null {
  if (caminho === "/") return ITENS_MENU[0]!;
  let melhor: { item: ItemDoMenu; tamanho: number } | null = null;
  for (const item of ITENS_MENU) {
    for (const c of item.caminhos) {
      if ((caminho === c || caminho.startsWith(c.endsWith("/documento") ? c : `${c}/`) || caminho.startsWith(`${c}?`)) && (!melhor || c.length > melhor.tamanho)) {
        melhor = { item, tamanho: c.length };
      }
    }
  }
  return melhor?.item ?? null;
}

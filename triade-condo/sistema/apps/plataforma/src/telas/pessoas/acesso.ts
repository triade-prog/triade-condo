// O acesso da pessoa por área (DC15, telas-modelo pessoas-*; decisão B.1 de 23/10/2026): as
// permissões do banco juntas na ordem do menu. Em cada área a pessoa não vê, vê ou cuida; cuidar
// já inclui ver (permissao_acoes). Pedidos guardam as quatro permissões separadas, e
// Comunicados e documentos tem publicar e cuidar dos documentos além do ver. Daqui sai também a
// frase do que a pessoa pode fazer, usada na lista e na ficha.

import type { Permissao } from "@triade/domain";
import type { NomeIcone } from "@triade/ui";

/** Uma área com um nível só: o código de ver e o de cuidar (ou só um deles). */
export interface AreaNivel {
  tipo: "nivel";
  id: string;
  nome: string;
  icone: NomeIcone;
  ajuda: string;
  ver?: Permissao;
  cuidar?: Permissao;
  /** Como se chama cada nível nesta área. */
  rotulos: { nao: string; ver?: string; cuidar?: string };
  /** Na frase: "cuida da agenda", "vê a agenda". */
  frase: { cuidar?: string; ver?: string };
}

/** Uma área com escolhas soltas (Pedidos; e o que vai além do ver nos comunicados). */
export interface AreaCaixas {
  tipo: "caixas";
  id: string;
  nome: string;
  icone: NomeIcone;
  ajuda: string;
  ver?: Permissao;
  rotulos?: { nao: string; ver: string };
  caixas: { codigo: Permissao; texto: string }[];
}

export type AreaAcesso = AreaNivel | AreaCaixas;

export const GRUPOS_ACESSO: { grupo: string; areas: AreaAcesso[] }[] = [
  { grupo: "Dia a dia", areas: [
    { tipo: "caixas", id: "pedidos", nome: "Pedidos", icone: "pedido", ajuda: "Escolha o que a pessoa faz com os pedidos.", caixas: [
      { codigo: "ACOMPANHAR", texto: "Ver os pedidos e o andamento" },
      { codigo: "RESPONDER", texto: "Dar retorno ao morador" },
      { codigo: "ATUALIZAR", texto: "Registrar e atualizar (etapa, categoria, prioridade, responsável, pendências)" },
      { codigo: "CONCLUIR", texto: "Concluir, reabrir e cancelar" },
    ] },
    { tipo: "nivel", id: "decisoes", nome: "Decisões", icone: "decisao", ajuda: "Aprovar despesas e decisões. Fica com o síndico, salvo se der esta permissão.",
      cuidar: "APROVAR", rotulos: { nao: "Não aprova", cuidar: "Aprova" }, frase: { cuidar: "aprova as decisões" } },
    { tipo: "nivel", id: "agenda", nome: "Agenda", icone: "calendario", ajuda: "Cuida: marca, muda, confirma e cancela compromissos.",
      ver: "VER_AGENDA", cuidar: "AGENDA", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "da agenda", ver: "a agenda" } },
    { tipo: "nivel", id: "manutencao", nome: "Manutenção", icone: "ferramenta", ajuda: "Cuida: registra manutenções, preventivas, vistorias e prestadores.",
      ver: "VER_MANUTENCAO", cuidar: "MANUTENCAO", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "da manutenção", ver: "a manutenção" } },
  ] },
  { grupo: "Comunicação", areas: [
    { tipo: "caixas", id: "comunicados", nome: "Comunicados e documentos", icone: "megafone", ajuda: "Vê os comunicados e os documentos, menos os restritos.",
      ver: "VER_COMUNICADOS", rotulos: { nao: "Não vê", ver: "Vê" }, caixas: [
        { codigo: "PUBLICAR", texto: "Publicar comunicados" },
        { codigo: "DOCUMENTOS", texto: "Cuidar dos documentos (versões, arquivar e os restritos)" },
      ] },
    { tipo: "nivel", id: "reservas", nome: "Reservas", icone: "calendario", ajuda: "Cuida: aprova, recusa e cancela reservas.",
      ver: "VER_RESERVAS", cuidar: "RESERVAS", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "das reservas", ver: "as reservas" } },
    { tipo: "nivel", id: "enquetes", nome: "Enquetes", icone: "grafico", ajuda: "Cuida: cria, encerra e publica o resultado.",
      ver: "VER_ENQUETES", cuidar: "ENQUETES", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "das enquetes", ver: "as enquetes" } },
    { tipo: "nivel", id: "assembleias", nome: "Assembleias", icone: "pessoas", ajuda: "Cuida: convoca, conduz a votação e faz a ata.",
      ver: "VER_ASSEMBLEIAS", cuidar: "ASSEMBLEIAS", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "das assembleias", ver: "as assembleias" } },
    { tipo: "nivel", id: "classificados", nome: "Classificados", icone: "megafone", ajuda: "Cuida: publica, recusa e tira do mural.",
      ver: "VER_CLASSIFICADOS", cuidar: "CLASSIFICADOS", rotulos: { nao: "Não vê", ver: "Vê", cuidar: "Cuida" }, frase: { cuidar: "dos classificados", ver: "os classificados" } },
  ] },
  { grupo: "Prédio e pessoas", areas: [
    { tipo: "nivel", id: "moradores", nome: "Moradores e unidades", icone: "predio", ajuda: "Inclui e corrige unidades e contatos. O que a pessoa inclui fica a confirmar pelo síndico.",
      cuidar: "CADASTRAR", rotulos: { nao: "Não vê", cuidar: "Cadastra" }, frase: { cuidar: "cadastra moradores" } },
  ] },
  { grupo: "Gestão", areas: [
    { tipo: "nivel", id: "configuracoes", nome: "Configurações", icone: "ajuste", ajuda: "Todo mundo vê. Muda: horários, categorias, prioridades, etapas, respostas e prazos.",
      cuidar: "CONFIGURAR", rotulos: { nao: "Só vê", cuidar: "Muda" }, frase: { cuidar: "das configurações" } },
  ] },
];

export type Nivel = "nao" | "ver" | "cuidar";

export function nivelDe(area: AreaNivel, marcadas: readonly string[]): Nivel {
  if (area.cuidar && marcadas.includes(area.cuidar)) return "cuidar";
  if (area.ver && marcadas.includes(area.ver)) return "ver";
  return "nao";
}

/** Troca o nível da área: tira os dois códigos e põe o do nível escolhido. */
export function comNivel(area: AreaNivel, marcadas: readonly string[], nivel: Nivel): string[] {
  const sem = marcadas.filter((p) => p !== area.ver && p !== area.cuidar);
  const codigo = nivel === "cuidar" ? area.cuidar : nivel === "ver" ? area.ver : undefined;
  return codigo ? [...sem, codigo] : sem;
}

/** Marca ou desmarca uma caixa. Nos pedidos, qualquer outra já marca o ver; tirar o ver tira todas. */
export function comCaixa(area: AreaCaixas, marcadas: readonly string[], codigo: string, marcada: boolean): string[] {
  const sem = marcadas.filter((p) => p !== codigo);
  if (area.id === "pedidos") {
    if (codigo === "ACOMPANHAR" && !marcada) return sem.filter((p) => !area.caixas.some((c) => c.codigo === p));
    if (marcada) return [...new Set([...sem, codigo, "ACOMPANHAR"])];
    return sem;
  }
  return marcada ? [...sem, codigo] : sem;
}

/** O ver dos comunicados com as caixas: sem ver, as caixas saem. */
export function comVerCaixas(area: AreaCaixas, marcadas: readonly string[], ver: boolean): string[] {
  const sem = marcadas.filter((p) => p !== area.ver && !area.caixas.some((c) => c.codigo === p));
  return ver && area.ver ? [...sem, area.ver] : sem;
}

/** As áreas que existem neste banco: só os códigos que têm o que fazer (permissoesDisponiveis). */
export function gruposDisponiveis(disponiveis: readonly string[]): typeof GRUPOS_ACESSO {
  const tem = (c?: string) => !!c && disponiveis.includes(c);
  return GRUPOS_ACESSO.map((g) => ({
    grupo: g.grupo,
    areas: g.areas.flatMap((a): AreaAcesso[] => {
      if (a.tipo === "nivel") {
        const ver = tem(a.ver) ? a.ver : undefined;
        const cuidar = tem(a.cuidar) ? a.cuidar : undefined;
        return ver || cuidar ? [{ ...a, ver, cuidar }] : [];
      }
      const caixas = a.caixas.filter((c) => tem(c.codigo));
      const ver = tem(a.ver) ? a.ver : undefined;
      return caixas.length || ver ? [{ ...a, ver, caixas }] : [];
    }),
  })).filter((g) => g.areas.length);
}

function lista(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : (itens[0] ?? "");
}

const VERBO_PEDIDO: Record<string, string> = { RESPONDER: "dar retorno", ATUALIZAR: "atualizar", CONCLUIR: "concluir" };

/** O que a área diz na frase e na ficha: o nível e, quando for o caso, o que falta. */
export function resumoDaArea(area: AreaAcesso, marcadas: readonly string[]): { nivel: string; tom: "violeta" | "info" | "neutro"; detalhe?: string } {
  if (area.tipo === "nivel") {
    const n = nivelDe(area, marcadas);
    return { nivel: area.rotulos[n] ?? area.rotulos.nao, tom: n === "cuidar" ? "violeta" : n === "ver" ? "info" : "neutro" };
  }
  if (area.id === "pedidos") {
    const tem = area.caixas.filter((c) => marcadas.includes(c.codigo)).map((c): string => c.codigo);
    if (!tem.includes("ACOMPANHAR")) return { nivel: "Não vê", tom: "neutro" };
    const faz = tem.filter((c) => VERBO_PEDIDO[c]);
    const falta = Object.keys(VERBO_PEDIDO).filter((c) => area.caixas.some((x) => x.codigo === c) && !tem.includes(c));
    if (!faz.length) return { nivel: "Vê", tom: "info" };
    return { nivel: falta.length ? `Cuida, sem ${lista(falta.map((c) => VERBO_PEDIDO[c]!)).replace(/ e /, " nem ")}` : "Cuida", tom: "violeta" };
  }
  const ver = !!area.ver && marcadas.includes(area.ver);
  const extras = area.caixas.filter((c) => marcadas.includes(c.codigo));
  const nao = area.caixas.filter((c) => !marcadas.includes(c.codigo));
  if (!ver && !extras.length) return { nivel: "Não vê", tom: "neutro" };
  const detalhe = extras.length === area.caixas.length ? "Publica e cuida dos documentos"
    : extras.length ? `${extras[0]!.codigo === "PUBLICAR" ? "Publica comunicados" : "Cuida dos documentos"}; não ${nao[0]!.codigo === "PUBLICAR" ? "publica" : "cuida dos documentos"}`
      : "Não publica nem cuida dos documentos";
  return { nivel: extras.length ? "Cuida" : "Vê", tom: extras.length ? "violeta" : "info", detalhe };
}

/** A frase do que a pessoa pode fazer: "Cuida dos pedidos (sem concluir) e da agenda · vê a manutenção". */
export function fraseDoAcesso(marcadas: readonly string[]): string {
  const cuida: string[] = [];
  const outras: string[] = [];
  const ve: string[] = [];
  for (const g of GRUPOS_ACESSO) {
    for (const a of g.areas) {
      if (a.tipo === "nivel") {
        const n = nivelDe(a, marcadas);
        const texto = n === "cuidar" ? a.frase.cuidar : n === "ver" ? a.frase.ver : undefined;
        if (!texto) continue;
        if (n === "ver") ve.push(texto);
        else if (/^d[aoe]s? /.test(texto)) cuida.push(texto);
        else outras.push(texto);
      } else if (a.id === "pedidos") {
        const r = resumoDaArea(a, marcadas);
        if (r.nivel === "Vê") ve.push("os pedidos");
        else if (r.nivel.startsWith("Cuida")) cuida.push(r.nivel === "Cuida" ? "dos pedidos" : `dos pedidos (${r.nivel.slice(7)})`);
      } else {
        if (marcadas.includes("PUBLICAR")) outras.push("publica comunicados");
        if (marcadas.includes("DOCUMENTOS")) cuida.push("dos documentos");
        else if (a.ver && marcadas.includes(a.ver)) ve.push("os comunicados", "os documentos");
      }
    }
  }
  const partes = [cuida.length ? `cuida ${lista(cuida)}` : null, ...outras, ve.length ? `vê ${lista(ve)}` : null].filter(Boolean) as string[];
  if (!partes.length) return "Só vê o painel e as configurações";
  const frase = partes.join(" · ");
  return frase[0]!.toUpperCase() + frase.slice(1);
}

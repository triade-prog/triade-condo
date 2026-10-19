// Parte das assembleias da API falsa da Plataforma (peça R12; AC-02). As regras de verdade estão
// testadas no banco (pgTAP 025) e na API (Deno); aqui só o bastante para a tela: a lista, o
// rascunho, convocar, a procuração, a votação item a item, a ata e o link pessoal.
import type { Route } from "@playwright/test";

type Estado = "RASCUNHO" | "CONVOCADA" | "EM_ANDAMENTO" | "ENCERRADA" | "CANCELADA";
interface ItemFalso {
  id: string; ordem: number; titulo: string; descricao?: string; tipo: "APROVACAO" | "ESCOLHA"; opcoes: string[]; quorum: string;
  estado: "AGUARDANDO" | "ABERTO" | "ENCERRADO"; resultado?: Record<string, unknown>;
}
interface ConviteFalso {
  id: string; unidade: string; peso: number; codigo: string; proprietarios: string; semDireito?: string; presente?: "ONLINE" | "SALAO";
  procuracao?: { estado: "PENDENTE" | "ACEITA" | "RECUSADA"; nome: string; unidadeId?: string; motivo?: string }; votos: Record<string, number>;
}
interface AssembleiaFalsa {
  id: string; titulo: string; tipo: string; forma: string; primeiraChamada: string; segundaChamada: string; local?: string; linkVideo?: string;
  estado: Estado; versao: number; itens: ItemFalso[]; convites: ConviteFalso[]; ataTexto?: string; ataDocumento?: { id: string; titulo: string };
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
export interface EstadoAssembleias { assembleias: AssembleiaFalsa[]; regras: { antecedencia: number; peso: "FRACAO"; versao: number } }

let n = 0;
const novoId = () => `9a0b1c2d-3e4f-4a5b-8c6d-${String(++n).padStart(12, "0")}`;
const em = (dias: number) => new Date(Date.now() + dias * 86400_000).toISOString();
const agora = () => new Date().toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const UNIDADES: [string, number, string][] = [
  ["Torre A · 101", 30, "Marta Lima"], ["Torre A · 102", 25, "Rafael Dias"], ["Torre A · 201", 25, "Bruna Souza"], ["Torre A · 302", 20, "Carlos Lima"],
];
const convites = (codigos: string[]): ConviteFalso[] =>
  UNIDADES.map(([unidade, peso, proprietarios], i) => ({ id: novoId(), unidade, peso, proprietarios, codigo: codigos[i]!, votos: {} }));

const aprovacao = (ordem: number, titulo: string, quorum: string, estado: ItemFalso["estado"] = "AGUARDANDO"): ItemFalso =>
  ({ id: novoId(), ordem, titulo, tipo: "APROVACAO", opcoes: ["Sim", "Não", "Abstenção"], quorum, estado });

export function criarAssembleias(): EstadoAssembleias {
  const ago: AssembleiaFalsa = {
    id: novoId(), titulo: "Assembleia geral ordinária 2026", tipo: "ORDINARIA", forma: "HIBRIDA", primeiraChamada: em(-0.02), segundaChamada: em(-0.01),
    local: "Salão de festas", linkVideo: "https://meet.exemplo.invalid/ipe-ago", estado: "EM_ANDAMENTO", versao: 4,
    itens: [
      aprovacao(1, "Aprovar as contas de 2025", "MAIORIA_PRESENTES", "ENCERRADO"),
      aprovacao(2, "Aprovar a troca do portão da garagem", "MAIORIA_PRESENTES", "ABERTO"),
      aprovacao(3, "Alterar a convenção: uso do terraço", "UNANIMIDADE"),
    ],
    convites: convites(["K7QM-3XPA-9TRE", "B4C5-D6E7-F8G9", "C5D6-E7F8-G9H2", "D6E7-F8G9-H2J3"]),
    historico: [{ acao: "assembleia.iniciada", em: em(-0.01), autor: "Ana Souza", dados: {} }],
  };
  // Presentes: 101 e 302 (online), 102 no salão; a 201 não veio.
  Object.assign(ago.convites[0]!, { presente: "ONLINE", votos: { 1: 1, 2: 1 } });
  Object.assign(ago.convites[1]!, { presente: "SALAO", votos: { 1: 1 } });
  Object.assign(ago.convites[3]!, { presente: "ONLINE", votos: { 1: 2 } });
  const age: AssembleiaFalsa = {
    id: novoId(), titulo: "Assembleia da fachada", tipo: "EXTRAORDINARIA", forma: "ONLINE", primeiraChamada: em(15), segundaChamada: em(15.02),
    linkVideo: "https://meet.exemplo.invalid/ipe-age", estado: "CONVOCADA", versao: 2,
    itens: [aprovacao(1, "Pintar a fachada", "MAIORIA_TODAS")],
    convites: convites(["F8NW-2HJK-4MPQ", "F9NW-3HJK-5MPQ", "G1NW-4HJK-6MPQ", "G2NW-5HJK-7MPQ"]),
    historico: [{ acao: "assembleia.convocada", em: em(-1), autor: "Ana Souza", dados: { unidades: 4 } }],
  };
  age.convites[2]!.procuracao = { estado: "PENDENTE", nome: "Carlos Lima", unidadeId: age.convites[3]!.id };
  return { assembleias: [ago, age], regras: { antecedencia: 10, peso: "FRACAO", versao: 3 } };
}

const representados = (a: AssembleiaFalsa, c: ConviteFalso) => a.convites.filter((x) =>
  (x.id === c.id && !(x.procuracao?.estado === "ACEITA" && x.procuracao.unidadeId)) || (x.procuracao?.estado === "ACEITA" && x.procuracao.unidadeId === c.id));

function resultado(a: AssembleiaFalsa, i: ItemFalso) {
  if (i.resultado) return i.resultado;
  const total = a.convites.reduce((s, c) => s + c.peso, 0);
  const presentes = a.convites.filter((c) => c.presente && !c.semDireito);
  const pesoPresentes = presentes.reduce((s, c) => s + c.peso, 0);
  const votos = a.convites.filter((c) => c.votos[i.ordem]);
  const pesos = i.opcoes.map((_, k) => votos.filter((c) => c.votos[i.ordem] === k + 1).reduce((s, c) => s + c.peso, 0));
  const meta = i.quorum === "MAIORIA_TODAS" ? total / 2 : i.quorum === "DOIS_TERCOS_TODAS" ? (total * 2) / 3 : i.quorum === "UNANIMIDADE" ? total : null;
  const sim = pesos[0]!;
  const aprovado = meta === null ? sim > pesos[1]! : i.quorum === "MAIORIA_TODAS" ? sim > meta : sim >= meta;
  return {
    opcoes: i.opcoes.map((texto, k) => ({ texto, votos: votos.filter((c) => c.votos[i.ordem] === k + 1).length, peso: pesos[k],
      porcentagem: pesoPresentes ? Math.round((1000 * pesos[k]!) / pesoPresentes) / 10 : 0 })),
    votaram: votos.length, presentes: presentes.length, pesoPresentes, pesoTotal: total,
    porcentagemPresentes: Math.round((1000 * pesoPresentes) / total) / 10, situacao: aprovado ? "APROVADO" : "REPROVADO",
    alcancavel: meta === null ? true : pesoPresentes >= meta, validos: pesos[0]! + pesos[1]!,
  };
}

function assembleiaJson(a: AssembleiaFalsa, regras: EstadoAssembleias["regras"]) {
  const total = a.convites.reduce((s, c) => s + c.peso, 0);
  const pres = a.convites.filter((c) => c.presente);
  return {
    id: a.id, titulo: a.titulo, tipo: a.tipo, forma: a.forma, primeiraChamada: a.primeiraChamada, segundaChamada: a.segundaChamada,
    ...(a.local ? { local: a.local } : {}), ...(a.linkVideo ? { linkVideo: a.linkVideo } : {}), estado: a.estado, peso: regras.peso,
    antecedencia: regras.antecedencia, enviarAte: new Date(Date.parse(a.primeiraChamada) - regras.antecedencia * 86400_000).toISOString().slice(0, 10),
    ...(a.ataTexto !== undefined ? { ataTexto: a.ataTexto } : {}), ...(a.ataDocumento ? { ataDocumento: a.ataDocumento } : {}),
    itens: a.itens.map((i) => ({ ...i, resultado: resultado(a, i) })),
    ...(a.estado === "RASCUNHO" || a.estado === "CANCELADA" ? {} : { presenca: {
      unidades: a.convites.length, presentes: pres.length, online: pres.filter((c) => c.presente === "ONLINE").length,
      salao: pres.filter((c) => c.presente === "SALAO").length, porProcuracao: a.convites.filter((c) => c.procuracao?.estado === "ACEITA").length,
      procuracoesPendentes: a.convites.filter((c) => c.procuracao?.estado === "PENDENTE").length, semDireito: a.convites.filter((c) => c.semDireito).length,
      porcentagem: Math.round((1000 * pres.reduce((s, c) => s + c.peso, 0)) / total) / 10,
    } }),
    criadoEm: em(-20), versao: a.versao,
  };
}

const nome = (a: AssembleiaFalsa, id?: string) => a.convites.find((c) => c.id === id)?.unidade;

export function resumoAssembleia(v: EstadoAssembleias) {
  const a = v.assembleias.filter((x) => x.estado === "CONVOCADA" || x.estado === "EM_ANDAMENTO").sort((x, y) => x.primeiraChamada.localeCompare(y.primeiraChamada))[0];
  return a ? { id: a.id, titulo: a.titulo, estado: a.estado, primeiraChamada: a.primeiraChamada,
    procuracoesPendentes: a.convites.filter((c) => c.procuracao?.estado === "PENDENTE").length } : undefined;
}

export async function rotasAssembleias(route: Route, v: EstadoAssembleias, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (caminho === "/v1/condominio/fracoes") {
    if (metodo === "GET") {
      return route.fulfill({ json: { unidades: UNIDADES.map(([nome, fracao], i) => ({ id: `fr-${i}`, nome, fracao, versao: 1 })), soma: 100, pode: { editar: pode("moradores.editar") } } });
    }
    return route.fulfill({ json: { alteradas: (corpo.fracoes as unknown[]).length, soma: 100 } });
  }
  if (!caminho.startsWith("/v1/condominio/assembleias")) return null;
  if (!pode("assembleias.ver")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/assembleias" && metodo === "GET") {
    return route.fulfill({ json: {
      assembleias: v.assembleias.map((a) => ({ id: a.id, titulo: a.titulo, tipo: a.tipo, forma: a.forma, estado: a.estado, primeiraChamada: a.primeiraChamada,
        itens: a.itens.length, presentes: a.convites.filter((c) => c.presente).length, unidades: a.estado === "RASCUNHO" ? 0 : a.convites.length,
        procuracoesPendentes: a.convites.filter((c) => c.procuracao?.estado === "PENDENTE").length })),
      regras: v.regras, semFracao: 0, unidades: 4, pode: { editar: pode("assembleias.editar"), configurar: pode("config.editar"), fracoes: pode("moradores.editar") },
    } });
  }
  if (!pode("assembleias.editar") && metodo !== "GET") return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/assembleias/regras") {
    v.regras = { ...v.regras, antecedencia: Number(corpo.antecedencia), versao: v.regras.versao + 1 };
    return route.fulfill({ json: { versao: v.regras.versao } });
  }
  if (caminho === "/v1/condominio/assembleias" && metodo === "POST") {
    const itens = corpo.itens as { titulo: string; tipo: "APROVACAO" | "ESCOLHA"; opcoes?: string[]; quorum: string }[];
    const campos = itens.flatMap((i, k) => (i.titulo.trim().length < 3 ? [`itens.${k + 1}.titulo`] : []));
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const a: AssembleiaFalsa = {
      id: novoId(), titulo: String(corpo.titulo).trim(), tipo: String(corpo.tipo), forma: String(corpo.forma), primeiraChamada: String(corpo.primeiraChamada),
      segundaChamada: String(corpo.segundaChamada), local: String(corpo.local ?? "") || undefined, linkVideo: String(corpo.linkVideo ?? "") || undefined,
      estado: "RASCUNHO", versao: 1,
      itens: itens.map((i, k) => ({ id: novoId(), ordem: k + 1, titulo: i.titulo.trim(), tipo: i.tipo, quorum: i.quorum, estado: "AGUARDANDO",
        opcoes: i.tipo === "APROVACAO" ? ["Sim", "Não", "Abstenção"] : [...(i.opcoes ?? []).filter(Boolean), "Em branco"] })),
      convites: convites(["H3NW-6HJK-8MPQ", "H4NW-7HJK-9MPQ", "J5NW-8HJK-2MPQ", "J6NW-9HJK-3MPQ"]),
      historico: [{ acao: "assembleia.criada", em: agora(), autor: eu.nome, dados: {} }],
    };
    v.assembleias.unshift(a);
    return route.fulfill({ status: 201, json: { id: a.id, versao: 1 } });
  }

  const m = /^\/v1\/condominio\/assembleias\/([^/]+)(?:\/(.+))?$/.exec(caminho);
  const a = m ? v.assembleias.find((x) => x.id === m[1]) : undefined;
  if (!m || !a) return erro(route, 404, "NOT_FOUND");
  const acao = m[2];
  const registrar = (x: string, dados: Record<string, unknown> = {}) => a.historico.push({ acao: x, em: agora(), autor: eu.nome, dados });
  if (!acao) {
    return route.fulfill({ json: {
      assembleia: assembleiaJson(a, v.regras),
      unidades: a.estado === "RASCUNHO" ? [] : a.convites.map((c) => ({
        id: c.id, unidade: c.unidade, peso: c.peso, semDireito: !!c.semDireito, ...(c.semDireito ? { motivoSemDireito: c.semDireito } : {}),
        ...(c.procuracao ? { procuracao: { estado: c.procuracao.estado, nome: c.procuracao.nome, em: em(-1), unidade: nome(a, c.procuracao.unidadeId), motivo: c.procuracao.motivo } } : {}),
        ...(c.presente ? { presenteEm: em(-0.005), presencaForma: c.presente } : {}), proprietarios: c.proprietarios, semContato: false,
        ...(Object.keys(c.votos).length ? { votos: c.votos } : {}),
      })),
      documentos: [{ id: "doc-ata-1", titulo: "Ata da AGO 2026 assinada" }], historico: [...a.historico].reverse(), pode: { editar: pode("assembleias.editar") },
    } });
  }
  const convite = a.convites.find((c) => c.id === corpo.conviteId);
  const item = a.itens.find((i) => i.id === corpo.itemId);
  const ok = (json: unknown = { ok: true }) => route.fulfill({ json });
  switch (acao) {
    case "convocar":
      Object.assign(a, { estado: "CONVOCADA", versao: a.versao + 1 });
      registrar("assembleia.convocada", { unidades: a.convites.length });
      return ok({ versao: a.versao, unidades: a.convites.length, envios: 5, comunicadoId: novoId() });
    case "procuracao":
      if (!convite?.procuracao) return erro(route, 404, "NOT_FOUND");
      if (!corpo.aceitar && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(convite.procuracao, { estado: corpo.aceitar ? "ACEITA" : "RECUSADA", motivo: corpo.aceitar ? undefined : corpo.motivo });
      registrar(corpo.aceitar ? "assembleia.procuracao_aceita" : "assembleia.procuracao_recusada", { unidade: convite.unidade, motivo: corpo.motivo });
      return ok();
    case "link":
      return ok({ codigo: convite?.codigo });
    case "itens/abrir":
      if (a.itens.some((i) => i.estado === "ABERTO")) return erro(route, 400, "VALIDATION_ERROR", { motivo: "OUTRO_ITEM_ABERTO" });
      item!.estado = "ABERTO";
      registrar("assembleia.item_aberto", { item: item!.ordem });
      return ok();
    case "itens/encerrar":
      item!.resultado = resultado(a, item!);
      item!.estado = "ENCERRADO";
      registrar("assembleia.item_encerrado", { item: item!.ordem, situacao: item!.resultado.situacao });
      return ok();
    case "voto":
      if (!convite || !item || item.estado !== "ABERTO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ITEM_FECHADO" });
      convite.votos[item.ordem] = Number(corpo.opcao);
      convite.presente = convite.presente ?? "SALAO";
      return ok();
    case "presenca":
      convite!.presente = corpo.presente ? "SALAO" : undefined;
      registrar(corpo.presente ? "assembleia.presenca" : "assembleia.presenca_retirada", { unidade: convite!.unidade });
      return ok();
    case "encerrar":
      for (const i of a.itens.filter((x) => x.estado === "ABERTO")) { i.resultado = resultado(a, i); i.estado = "ENCERRADO"; }
      Object.assign(a, { estado: "ENCERRADA", versao: a.versao + 1,
        ataTexto: `Ata da assembleia geral ordinária do Residencial Ipê.\n\nPresidente: \nSecretário: \n\nPresentes: ${a.convites.filter((c) => c.presente).length} de 4 unidades.` });
      registrar("assembleia.encerrada");
      return ok({ versao: a.versao });
    case "ata":
      if (corpo.versao !== a.versao) return erro(route, 409, "VERSION_CONFLICT");
      a.ataTexto = String(corpo.texto ?? a.ataTexto);
      if (corpo.documentoId) a.ataDocumento = { id: String(corpo.documentoId), titulo: "Ata da AGO 2026 assinada" };
      a.versao += 1;
      return ok({ versao: a.versao });
    default:
      return erro(route, 404, "NOT_FOUND");
  }
}

/** O link pessoal da assembleia, sem conta. */
export async function rotasAssembleiaPublica(route: Route, v: EstadoAssembleias, caminho: string, metodo: string, corpo: Record<string, unknown>): Promise<unknown> {
  const m = /^\/v1\/publico\/a\/([^/]+)(?:\/(voto|procuracao))?$/.exec(caminho);
  if (!m) return null;
  const a = v.assembleias.find((x) => x.convites.some((c) => c.codigo === m[1]));
  const c = a?.convites.find((x) => x.codigo === m[1]);
  if (!a || !c) return erro(route, 404, "NOT_FOUND");
  const json = () => ({
    condominio: "Residencial Ipê", titulo: a.titulo, tipo: a.tipo, forma: a.forma, estado: a.estado, primeiraChamada: a.primeiraChamada,
    segundaChamada: a.segundaChamada, ...(a.local ? { local: a.local } : {}), ...(a.linkVideo ? { linkVideo: a.linkVideo } : {}), peso: "FRACAO",
    unidade: c.unidade, proprietarios: c.proprietarios, semDireito: !!c.semDireito,
    ...(c.procuracao ? { procuracao: { estado: c.procuracao.estado, nome: c.procuracao.nome, unidade: nome(a, c.procuracao.unidadeId), motivo: c.procuracao.motivo } } : {}),
    ...(a.convites.some((x) => x.procuracao?.estado === "ACEITA" && x.procuracao.unidadeId === c.id)
      ? { representa: a.convites.filter((x) => x.procuracao?.estado === "ACEITA" && x.procuracao.unidadeId === c.id).map((x) => x.unidade) } : {}),
    ...(a.estado === "CONVOCADA" ? { outrasUnidades: a.convites.filter((x) => x.id !== c.id).map((x) => ({ id: x.id, nome: x.unidade })) } : {}),
    ...(c.presente ? { presenteEm: em(-0.005) } : {}),
    itens: a.itens.map((i) => ({ id: i.id, ordem: i.ordem, titulo: i.titulo, opcoes: i.opcoes, estado: i.estado, quorum: i.quorum,
      ...(c.votos[i.ordem] ? { meuVoto: c.votos[i.ordem] } : {}), ...(i.estado === "ENCERRADO" ? { resultado: resultado(a, i) } : {}) })),
  });
  if (metodo === "GET") {
    if (a.estado === "EM_ANDAMENTO") for (const r of representados(a, c)) r.presente = r.presente ?? "ONLINE";
    return route.fulfill({ json: json() });
  }
  if (m[2] === "procuracao") {
    if (a.estado !== "CONVOCADA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ASSEMBLEIA_FORA_DE_HORA" });
    if (corpo.nome === null) c.procuracao = undefined;
    else if (String(corpo.nome).trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    else c.procuracao = { estado: "PENDENTE", nome: String(corpo.nome).trim(), unidadeId: (corpo.unidadeId as string | null) ?? undefined };
    return route.fulfill({ json: json() });
  }
  const i = a.itens.find((x) => x.id === corpo.itemId);
  if (a.estado !== "EM_ANDAMENTO" || !i || i.estado !== "ABERTO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ITEM_FECHADO" });
  for (const r of representados(a, c)) { r.votos[i.ordem] = Number(corpo.opcao); r.presente = r.presente ?? "ONLINE"; }
  return route.fulfill({ json: json() });
}

// Parte da F7.4 na API falsa da Plataforma: pedidos relacionados (AT-18) e decisões pedidas ao
// síndico (AT-23). As regras de verdade estão testadas no banco (pgTAP 029) e na API (Deno);
// aqui só o bastante para a tela.
import type { Route } from "@playwright/test";
import { AGORA } from "./api-falsa-pedidos";

const HORA = 3600_000;
const DIA = 24 * HORA;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();
const diaDe = (iso: string) => new Date(Date.parse(iso) - 3 * HORA).toISOString().slice(0, 10);
const HOJE = diaDe(AGORA);
let n = 0;
const novoId = () => `8f9a0b1c-2d3e-4f4a-9b5c-${String(++n).padStart(12, "0")}`;

interface Pendencia { id: string; tipo: string; motivo: string; responsavelId: string; abertaEm: string; abertaPor: string; resolvidaEm: string | null; resolvidaPor: string | null; resolucao: string | null }
interface PedidoFalso {
  id: string; protocolo: string; assunto: string; estado: string; local: string | null; versao: number; unidadeId: string | null; categoriaId: string;
  etapaId: string; abertoEm: string; encerradoEm: string | null; proximoRetorno: string | null; privado: boolean; pendencias: Pendencia[];
  conclusoes: object[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
interface Pessoa { vinculoId: string; nome: string; funcao: string }
interface Alternativa { numero: number; descricao: string; detalhe?: string; custo?: number; moeda?: string }
interface DecisaoFalsa {
  id: string; versao: number; estado: string; pedidoId: string; pendenciaId: string; pergunta: string; porque?: string; prazo: string; decisorId: string;
  pedidaEm: string; pedidaPor: string; respondidaEm?: string; respondidaPor?: string; alternativaAprovada?: number; justificativa?: string; retiradaMotivo?: string;
  alternativas: Alternativa[];
}
interface Ligacao { id: string; pedidoId: string; outroId: string; tipo: string; motivo: string; em: string; por: string; desfeita: boolean }
interface AvisoDecisao { id: string; para: string; decisaoId: string; tipo: string; criadoEm: string; vistoEm: string | null }

export interface EstadoDecisoes {
  dias: number;
  ligacoes: Ligacao[];
  descartados: string[];
  decisoes: DecisaoFalsa[];
  avisos: AvisoDecisao[];
}

export function criarDecisoes(): EstadoDecisoes {
  return { dias: 90, ligacoes: [], descartados: [], decisoes: [], avisos: [] };
}

/** Com a F7.4 em uso: um pedido do portão concluído há 20 dias e outro aberto há 1 h, parecidos com o 2026-0002;
 * e uma decisão pedida pela Bruna à Ana no 2026-0001, com o prazo vencido ontem. */
export function semearDecisoes(estado: EstadoDecisoes, pedidos: PedidoFalso[], vAna: string, concluido: string) {
  const p2 = pedidos[1]!;
  const clone = (protocolo: string, m: Partial<PedidoFalso>): PedidoFalso => ({ ...structuredClone(p2), id: novoId(), protocolo, pendencias: [], conclusoes: [],
    historico: [{ acao: "pedido.registrado", em: m.abertoEm!, autor: "Ana Souza", dados: { protocolo, canal: "OBSERVACAO" } }], ...m });
  pedidos.push(
    clone("2026-0004", { assunto: "Portão da garagem não fechava", estado: "ENCERRADO", etapaId: concluido, local: "portão da  garagem",
      abertoEm: depois(-25 * 24), encerradoEm: depois(-20 * 24), proximoRetorno: null }),
    clone("2026-0005", { assunto: "Portão aberto de madrugada", local: "Portão da garagem", abertoEm: depois(-1) }),
  );
  const p1 = pedidos[0]!;
  const pendencia = { id: novoId(), tipo: "DECISAO", motivo: "Qual encanador chamar para o vazamento", responsavelId: vAna, abertaEm: depois(-48),
    abertaPor: "Bruna", resolvidaEm: null, resolvidaPor: null, resolucao: null };
  p1.pendencias.push(pendencia);
  const d: DecisaoFalsa = {
    id: novoId(), versao: 1, estado: "AGUARDANDO", pedidoId: p1.id, pendenciaId: pendencia.id, pergunta: "Qual encanador chamar para o vazamento",
    porque: "O morador está sem usar o banheiro.", prazo: diaDe(depois(-24)), decisorId: vAna, pedidaEm: depois(-48), pedidaPor: "Bruna",
    alternativas: [{ numero: 1, descricao: "Hidráulica Silva", detalhe: "amanhã cedo", custo: 35000, moeda: "BRL" },
      { numero: 2, descricao: "Encanador da administradora", detalhe: "em 3 dias", custo: 52000, moeda: "BRL" }],
  };
  estado.decisoes.push(d);
  estado.avisos.push({ id: novoId(), para: vAna, decisaoId: d.id, tipo: "PEDIDA", criadoEm: depois(-48), vistoEm: null });
}

const chaveLocal = (t: string | null) => (t ? t.trim().toLowerCase().replace(/\s+/g, " ") : null);
const ativo = (p: { estado: string }) => p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
const par = (a: PedidoFalso, b: PedidoFalso) => (a.abertoEm > b.abertoEm || (a.abertoEm === b.abertoEm && a.protocolo > b.protocolo) ? [b, a] : [a, b]);
const podeReincidencia = (a: PedidoFalso, b: PedidoFalso) => {
  const [antigo, novo] = par(a, b);
  return antigo!.estado === "ENCERRADO" && !!antigo!.encerradoEm && antigo!.encerradoEm <= novo!.abertoEm;
};
const parDescartado = (a: string, b: string) => [a, b].sort().join("|");

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

interface Contexto {
  pedidos: PedidoFalso[];
  pessoas: Pessoa[];
  etapas: { id: string; nome: string; situacao: string }[];
  categoria: (id: string) => string;
  unidade: (id: string | null) => string | null;
  eu: { vinculo: string; nome: string };
  pode: (a: string) => boolean;
}

/** O que a F7.4 junta ao pedido: ligados, parecidos, decisões, quem decide e o que a pessoa pode. */
export function detalheDecisoes(estado: EstadoDecisoes, x: Contexto, p: PedidoFalso) {
  const atualizar = x.pode("pedidos.atualizar");
  const ligados = estado.ligacoes.filter((l) => !l.desfeita && (l.pedidoId === p.id || l.outroId === p.id)).map((l) => {
    const o = x.pedidos.find((y) => y.id === (l.pedidoId === p.id ? l.outroId : l.pedidoId))!;
    return { id: l.id, tipo: l.tipo, papel: l.pedidoId === p.id ? "NOVO" : "ANTIGO", motivo: l.motivo, em: l.em, por: l.por,
      pedido: { id: o.id, protocolo: o.protocolo, assunto: o.assunto, estado: o.estado, abertoEm: o.abertoEm, ...(o.encerradoEm ? { encerradoEm: o.encerradoEm } : {}) } };
  });
  const janela = estado.dias * DIA;
  const parecidos = !atualizar || p.estado === "CANCELADO" ? [] : x.pedidos
    .filter((o) => o.id !== p.id && o.estado !== "CANCELADO" && o.categoriaId === p.categoriaId
      && Math.abs(Date.parse(o.abertoEm) - Date.parse(p.abertoEm)) <= janela
      && ((p.unidadeId && o.unidadeId === p.unidadeId) || (chaveLocal(o.local) !== null && chaveLocal(o.local) === chaveLocal(p.local)))
      && !estado.ligacoes.some((l) => !l.desfeita && ((l.pedidoId === p.id && l.outroId === o.id) || (l.pedidoId === o.id && l.outroId === p.id)))
      && !estado.descartados.includes(parDescartado(p.id, o.id)))
    .sort((a, b) => Math.abs(Date.parse(a.abertoEm) - Date.parse(p.abertoEm)) - Math.abs(Date.parse(b.abertoEm) - Date.parse(p.abertoEm)))
    .slice(0, 5)
    .map((o) => ({ id: o.id, protocolo: o.protocolo, assunto: o.assunto, estado: o.estado, versao: o.versao, categoria: x.categoria(o.categoriaId),
      onde: o.local ?? x.unidade(o.unidadeId), abertoEm: o.abertoEm, encerradoEm: o.encerradoEm, podeReincidencia: podeReincidencia(p, o) }));
  return {
    relacionados: { ligados, parecidos, dias: estado.dias },
    decisoes: estado.decisoes.filter((d) => d.pedidoId === p.id).sort((a, b) => b.pedidaEm.localeCompare(a.pedidaEm)).map((d) => decisaoJson(d, x)),
    decisores: atualizar && ativo(p) ? decisores(x) : [],
    pode: { ligar: atualizar && p.estado !== "CANCELADO", pedirDecisao: atualizar && ativo(p) },
  };
}

function decisores(x: Contexto) {
  return x.pessoas.filter((p) => p.funcao === "SINDICO").map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, sindico: true, eu: p.vinculoId === x.eu.vinculo }));
}

function decisaoJson(d: DecisaoFalsa, x: Contexto) {
  const p = x.pedidos.find((y) => y.id === d.pedidoId)!;
  const eu = d.decisorId === x.eu.vinculo;
  const sindico = x.pessoas.find((y) => y.vinculoId === x.eu.vinculo)?.funcao === "SINDICO";
  return {
    id: d.id, versao: d.versao, estado: d.estado, pendenciaId: d.pendenciaId, pergunta: d.pergunta, ...(d.porque ? { porque: d.porque } : {}), prazo: d.prazo,
    vencida: d.estado === "AGUARDANDO" && d.prazo < HOJE, decisor: { vinculoId: d.decisorId, nome: x.pessoas.find((y) => y.vinculoId === d.decisorId)?.nome ?? "", eu },
    pedidaEm: d.pedidaEm, pedidaPor: d.pedidaPor,
    ...(d.respondidaEm ? { respondidaEm: d.respondidaEm, respondidaPor: d.respondidaPor } : {}),
    ...(d.alternativaAprovada ? { alternativaAprovada: d.alternativaAprovada } : {}),
    ...(d.justificativa ? { justificativa: d.justificativa } : {}), ...(d.retiradaMotivo ? { retiradaMotivo: d.retiradaMotivo } : {}),
    alternativas: d.alternativas, pedido: { id: p.id, protocolo: p.protocolo, assunto: p.assunto, estado: p.estado },
    pode: { responder: d.estado === "AGUARDANDO" && x.pode("decisoes.aprovar") && (eu || sindico),
      retirar: d.estado === "AGUARDANDO" && (d.pedidaPor === x.eu.nome || x.pode("pedidos.atualizar")) },
  };
}

/** Resumo do Início e do menu, para quem pode aprovar (decisão 10). */
export function resumoDecisoes(estado: EstadoDecisoes, eu: string) {
  const minhas = estado.decisoes.filter((d) => d.estado === "AGUARDANDO" && d.decisorId === eu);
  const maisAntiga = minhas.map((d) => d.pedidaEm).sort()[0];
  return { aguardando: minhas.length, vencidas: minhas.filter((d) => d.prazo < HOJE).length,
    maisAntigaDias: maisAntiga ? Math.round((Date.parse(`${HOJE}T00:00:00Z`) - Date.parse(`${diaDe(maisAntiga)}T00:00:00Z`)) / DIA) : null };
}

/** Os avisos das decisões no sino (decisão 9). */
export function avisosDecisoes(estado: EstadoDecisoes, x: Contexto) {
  return estado.avisos.filter((a) => a.para === x.eu.vinculo).map((a) => {
    const d = estado.decisoes.find((y) => y.id === a.decisaoId)!;
    const p = x.pedidos.find((y) => y.id === d.pedidoId)!;
    return { id: a.id, tipo: `DECISAO_${a.tipo}`, decisaoId: d.id, pedidoId: p.id, protocolo: p.protocolo, titulo: d.pergunta, prazo: d.prazo, estado: d.estado,
      criadoEm: a.criadoEm, vistoEm: a.vistoEm };
  });
}

export function marcarAvisosDecisoes(estado: EstadoDecisoes, eu: string, ids: string[] | null) {
  let marcados = 0;
  for (const a of estado.avisos) if (a.para === eu && !a.vistoEm && (!ids || ids.includes(a.id))) { a.vistoEm = AGORA; marcados++; }
  return marcados;
}

/** Atende as rotas da F7.4; devolve null quando a rota não é daqui. */
export async function rotasDecisoes(route: Route, estado: EstadoDecisoes, x: Contexto, config: { versao: number }, caminho: string, metodo: string,
  corpo: Record<string, unknown>, url: URL): Promise<void | null> {
  const texto = (k: string) => String(corpo[k] ?? "").trim();
  const hist = (p: PedidoFalso, acao: string, dados: Record<string, unknown>) => p.historico.push({ acao, em: AGORA, autor: x.eu.nome, dados });

  if (caminho === "/v1/condominio/regras-parecidos" && metodo === "PUT") {
    if (!x.pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== config.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: config.versao });
    if (![30, 60, 90, 180].includes(Number(corpo.dias))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["dias"] });
    estado.dias = Number(corpo.dias);
    config.versao++;
    return route.fulfill({ json: { versao: config.versao } });
  }

  const lig = /^\/v1\/condominio\/pedidos\/([^/]+)\/(ligacoes|parecidos\/descartar|decisoes)(?:\/([^/]+)\/desfazer)?$/.exec(caminho);
  if (lig && metodo === "POST") {
    const p = x.pedidos.find((y) => y.id === lig[1]);
    if (!p) return erro(route, 404, "NOT_FOUND");
    if (!x.pode("pedidos.atualizar")) return erro(route, 403, "FORBIDDEN");
    if (lig[2] === "parecidos/descartar") {
      estado.descartados.push(parDescartado(p.id, String(corpo.outroId)));
      return route.fulfill({ json: { ok: true } });
    }
    if (corpo.versao !== p.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: p.versao, atual: { id: p.id } });
    if (lig[3]) {
      const l = estado.ligacoes.find((y) => y.id === lig[3]);
      if (!l) return erro(route, 404, "NOT_FOUND");
      if (l.desfeita) return erro(route, 400, "VALIDATION_ERROR", { motivo: "LIGACAO_DESFEITA" });
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      l.desfeita = true;
      for (const [a, b] of [[l.pedidoId, l.outroId], [l.outroId, l.pedidoId]] as const) {
        hist(x.pedidos.find((y) => y.id === a)!, "pedido.ligacao_desfeita", { protocolo: x.pedidos.find((y) => y.id === b)!.protocolo, motivo: texto("motivo") });
      }
      p.versao++;
      return route.fulfill({ json: { versao: p.versao } });
    }
    if (lig[2] === "ligacoes") {
      const o = x.pedidos.find((y) => y.id === corpo.outroId);
      if (!o || o.id === p.id) return erro(route, 400, "VALIDATION_ERROR", { campos: ["outroId"] });
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      const [antigo, novo] = par(p, o);
      if (corpo.tipo === "REINCIDENCIA" && !podeReincidencia(p, o)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "NAO_E_REINCIDENCIA" });
      if (estado.ligacoes.some((l) => !l.desfeita && l.pedidoId === novo!.id)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "JA_LIGADO" });
      const encerrar = corpo.encerrar === true;
      if (encerrar && texto("texto").length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
      const l: Ligacao = { id: novoId(), pedidoId: novo!.id, outroId: antigo!.id, tipo: String(corpo.tipo), motivo: texto("motivo"), em: AGORA, por: x.eu.nome, desfeita: false };
      estado.ligacoes.push(l);
      hist(novo!, "pedido.ligado", { tipo: l.tipo, papel: "NOVO", protocolo: antigo!.protocolo });
      hist(antigo!, "pedido.ligado", { tipo: l.tipo, papel: "ANTIGO", protocolo: novo!.protocolo });
      if (encerrar) {
        const etapa = x.etapas.find((e) => e.nome === "Não procede")!;
        novo!.conclusoes.push({ id: novoId(), etapa: etapa.nome, etapaAnterior: novo!.etapaId, explicacao: texto("texto"), evidencia: null, concluidaEm: AGORA,
          concluidaPor: x.eu.nome, revisao: "SEM_REVISAO", revisadaEm: null, revisadaPor: null, motivoDevolucao: null, reabertaEm: null, reabertaPor: null,
          motivoReabertura: null });
        hist(novo!, "estado.mudou", { de: novo!.estado, para: "ENCERRADO", evento: "CONCLUIDO" });
        novo!.estado = "ENCERRADO"; novo!.etapaId = etapa.id; novo!.encerradoEm = AGORA; novo!.proximoRetorno = null; novo!.versao++;
      }
      if (novo!.id !== p.id || !encerrar) p.versao++;
      return route.fulfill({ json: { versao: p.versao, id: l.id } });
    }
    // Pedir decisão.
    if (texto("pergunta").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["pergunta"] });
    const prazo = String(corpo.prazo ?? "");
    if (!prazo || prazo < HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["prazo"] });
    const alternativas = (corpo.alternativas as { descricao: string; detalhe: string | null; custo: number | null }[]) ?? [];
    if (!alternativas.length || alternativas.some((a) => a.descricao.trim().length < 3)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["alternativas"] });
    const pendencia = { id: novoId(), tipo: "DECISAO", motivo: texto("pergunta").slice(0, 300), responsavelId: String(corpo.decisorId), abertaEm: AGORA,
      abertaPor: x.eu.nome, resolvidaEm: null, resolvidaPor: null, resolucao: null };
    p.pendencias.push(pendencia);
    const d: DecisaoFalsa = {
      id: novoId(), versao: 1, estado: "AGUARDANDO", pedidoId: p.id, pendenciaId: pendencia.id, pergunta: texto("pergunta"), ...(texto("porque") ? { porque: texto("porque") } : {}),
      prazo, decisorId: String(corpo.decisorId), pedidaEm: AGORA, pedidaPor: x.eu.nome,
      alternativas: alternativas.map((a, i) => ({ numero: i + 1, descricao: a.descricao, ...(a.detalhe ? { detalhe: a.detalhe } : {}),
        ...(a.custo !== null ? { custo: a.custo, moeda: "BRL" } : {}) })),
    };
    estado.decisoes.push(d);
    hist(p, "pedido.pendencia_aberta", { tipo: "DECISAO" });
    hist(p, "pedido.decisao_pedida", { alternativas: d.alternativas.length, prazo });
    if (d.decisorId !== x.eu.vinculo) estado.avisos.push({ id: novoId(), para: d.decisorId, decisaoId: d.id, tipo: "PEDIDA", criadoEm: AGORA, vistoEm: null });
    p.versao++;
    return route.fulfill({ json: { versao: p.versao, id: d.id } });
  }

  if (caminho === "/v1/condominio/decisoes" && metodo === "GET") {
    if (!x.pode("pedidos.ver")) return erro(route, 403, "FORBIDDEN");
    const filtro = url.searchParams.get("filtro") ?? "AGUARDANDO";
    if (!["AGUARDANDO", "DECIDIDAS", "TODAS"].includes(filtro)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["filtro"] });
    const lista = estado.decisoes.filter((d) => filtro === "AGUARDANDO" ? d.estado === "AGUARDANDO" && d.decisorId === x.eu.vinculo
      : filtro === "DECIDIDAS" ? ["APROVADA", "DEVOLVIDA"].includes(d.estado) : true)
      .sort((a, b) => Number(a.estado !== "AGUARDANDO") - Number(b.estado !== "AGUARDANDO") || a.prazo.localeCompare(b.prazo));
    return route.fulfill({ json: {
      decisoes: lista.map((d) => decisaoJson(d, x)), filtro, hoje: HOJE, pode: { aprovar: x.pode("decisoes.aprovar") },
      aguardandoEu: estado.decisoes.filter((d) => d.estado === "AGUARDANDO" && d.decisorId === x.eu.vinculo).length,
    } });
  }

  const dr = /^\/v1\/condominio\/decisoes\/([^/]+)\/(responder|retirar)$/.exec(caminho);
  if (dr && metodo === "POST") {
    const d = estado.decisoes.find((y) => y.id === dr[1]);
    if (!d) return erro(route, 404, "NOT_FOUND");
    if (corpo.versao !== d.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: d.versao });
    if (d.estado !== "AGUARDANDO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DECISAO_FECHADA" });
    const p = x.pedidos.find((y) => y.id === d.pedidoId)!;
    const pend = p.pendencias.find((y) => y.id === d.pendenciaId)!;
    if (dr[2] === "responder") {
      if (!x.pode("decisoes.aprovar")) return erro(route, 403, "FORBIDDEN");
      if (corpo.aprovar === true && !corpo.alternativa) return erro(route, 400, "VALIDATION_ERROR", { campos: ["alternativa"] });
      if (texto("justificativa").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["justificativa"] });
      d.estado = corpo.aprovar === true ? "APROVADA" : "DEVOLVIDA";
      if (corpo.aprovar === true) d.alternativaAprovada = Number(corpo.alternativa);
      d.justificativa = texto("justificativa");
      pend.resolucao = corpo.aprovar === true ? `Aprovada a alternativa ${d.alternativaAprovada}` : "Devolvida sem decidir";
      hist(p, "pedido.decisao_respondida", { aprovada: corpo.aprovar === true, ...(d.alternativaAprovada ? { alternativa: d.alternativaAprovada } : {}) });
    } else {
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      d.estado = "RETIRADA";
      d.retiradaMotivo = texto("motivo");
      pend.resolucao = "Pedido de decisão retirado";
      hist(p, "pedido.decisao_retirada", { motivo: d.retiradaMotivo });
    }
    d.respondidaEm = AGORA; d.respondidaPor = x.eu.nome; d.versao++;
    pend.resolvidaEm = AGORA; pend.resolvidaPor = x.eu.nome;
    hist(p, "pedido.pendencia_resolvida", { tipo: "DECISAO" });
    p.versao++;
    return route.fulfill({ json: { versao: d.versao } });
  }
  return null;
}

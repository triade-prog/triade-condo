// Parte de Links e QR da API falsa da Plataforma (peça R13; AT-30, MP-08, V-11). As regras de
// verdade estão testadas no banco (pgTAP 018) e na API (Deno); aqui só o bastante para a tela:
// etiquetas, a página sem conta da etiqueta e o link do prestador. Com a troca para o prestador
// reserva (F5.9, MP-09; pgTAP 028): o prazo para confirmar, confirmar ou recusar pelo link e a troca.
import type { Route } from "@playwright/test";
import { conferir, conteudoEnviado } from "./api-falsa-arquivos";
import type { EstadoManutencao } from "./api-falsa-manutencao";

export const ETIQUETA_FALSA = "R7TW-2KHM-9QXF";
export const PRESTADOR_FALSO = "UHJlc3RhZG9yLWNvZGlnby1mYWxzby0wMDAx";

interface EtiquetaFalsa {
  id: string; numero: number; local: string; onde: string | null; codigo: string; recado: string | null; recadoAte: string | null; recadoEm: string | null;
  ativa: boolean; motivoDesativacao: string | null; aberturas: number; versao: number; historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
export interface LinkFalso {
  id: string; manutencaoId: string; para: string; oQueFazer: string; quando: string | null; comoEntrar: string | null; expiraEm: string; abertoEm: string | null;
  criadoEm: string; codigo: string; revogado: string | null;
  responderHoras?: number; responderAte?: string; reservaId?: string; respondidoEm?: string; resposta?: "CONFIRMOU" | "RECUSOU" | "CHEGOU";
  trocaDesligadaEm?: string; trocaResultado?: "TROCOU" | "NAO_TROCOU"; trocadoEm?: string; trocaDe?: string;
  /** Mandado no registro do pedido (F6.7): o prazo e a reserva esperam a mensagem sair. */
  prazoNoEnvio?: number; reservaNoEnvio?: string; noRegistro?: { pedidoId: string; protocolo: string; meio: "WHATSAPP" | "EMAIL" };
}
interface RegistroFalso {
  id: string; linkId: string; manutencaoId: string; tipo: "CHEGOU" | "IMPEDIMENTO" | "TERMINOU"; confirmado?: boolean; etiqueta?: { rotulo: string; local: string };
  impedimento?: string; texto?: string; ficouPendente?: boolean; pendenteTexto?: string; quemFez?: string; em: string; fotos: string[];
}
export interface EstadoLinks {
  numero: string | null;
  /** Enquanto o WhatsApp está fora do ar (W-17): o canal alternativo da queda. */
  canalAlternativo?: string;
  etiquetas: EtiquetaFalsa[];
  links: LinkFalso[];
  registros: RegistroFalso[];
  fotos: { id: string; nome: string; tipo: string; linkId: string; situacao: string }[];
}

let n = 0;
const novoId = () => `5c6d7e8f-9a0b-4c1d-8e2f-${String(++n).padStart(12, "0")}`;
const rotulo = (x: number) => `E${String(x).padStart(2, "0")}`;
const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarLinks(): EstadoLinks {
  const e = (numero: number, local: string, x: Partial<EtiquetaFalsa> = {}): EtiquetaFalsa => ({
    id: novoId(), numero, local, onde: null, codigo: `AAAA-BBBB-CC${String(numero).padStart(2, "0").replace(/[01]/g, "Z")}`, recado: null, recadoAte: null,
    recadoEm: null, ativa: true, motivoDesativacao: null, aberturas: 0, versao: 1,
    historico: [{ acao: "etiqueta.criada", em: "2026-10-02T13:12:00Z", autor: "Ana Souza", dados: { local } }], ...x,
  });
  return {
    numero: "+5561990001234",
    etiquetas: [
      e(1, "Elevador social · bloco A", { onde: "Dentro da cabine", aberturas: 12 }),
      e(2, "Garagem · subsolo 1", { codigo: ETIQUETA_FALSA, onde: "Pilar perto da rampa", aberturas: 9, recado: "Já sabemos do portão travando. O técnico vem na segunda.",
        recadoAte: dia(3), recadoEm: "2026-10-17T21:30:00Z" }),
      e(3, "Casa de bombas · Bomba 2", { codigo: "PQRS-TUVW-XY23", onde: "Porta de entrada" }),
      e(4, "Salão de festas", { codigo: "PQRS-TUVW-XY45", ativa: false, motivoDesativacao: "Salão em reforma, etiqueta retirada" }),
    ],
    links: [],
    registros: [],
    fotos: [],
  };
}

function etiquetaJson(e: EtiquetaFalsa) {
  const recadoVale = e.recado && e.recadoAte && e.recadoAte >= dia(0);
  return {
    id: e.id, numero: e.numero, rotulo: rotulo(e.numero), local: e.local, onde: e.onde ?? undefined, codigo: e.codigo,
    recado: recadoVale ? e.recado : undefined, recadoAte: recadoVale ? e.recadoAte : undefined, ativa: e.ativa,
    motivoDesativacao: e.motivoDesativacao ?? undefined, aberturas7: e.aberturas, aberturasHoje: Math.min(3, e.aberturas), criadoEm: "2026-10-02T13:12:00Z", versao: e.versao,
  };
}

export const RESERVA_FALSO = "UmVzZXJ2YS1jb2RpZ28tZmFsc28tMDAwMDAwMDE";

/** A troca para a reserva (MP-09): o link para, a manutenção passa para a reserva e ela recebe um link novo. */
export function trocarParaReserva(est: EstadoLinks, man: EstadoManutencao, l: LinkFalso, motivo: "SEM_RESPOSTA" | "RECUSOU") {
  const m = man.manutencoes.find((x) => x.id === l.manutencaoId)!;
  const r = man.prestadores.find((p) => p.id === l.reservaId);
  if (!r || l.trocadoEm || l.trocaDesligadaEm) return;
  Object.assign(l, { revogado: motivo === "RECUSOU" ? "Passou para a reserva: o prestador não pode atender" : "Passou para a reserva: sem resposta no prazo",
    trocadoEm: agora(), trocaResultado: "TROCOU" });
  m.prestadorId = r.id;
  const ate = new Date(Date.now() + (l.responderHoras ?? 24) * 3600_000).toISOString();
  est.links.push({ id: novoId(), manutencaoId: m.id, para: r.nome, oQueFazer: l.oQueFazer, quando: l.quando, comoEntrar: l.comoEntrar, expiraEm: l.expiraEm,
    abertoEm: null, criadoEm: agora(), codigo: RESERVA_FALSO, revogado: null, responderHoras: l.responderHoras, responderAte: ate, trocaDe: l.para });
  m.historico.unshift({ acao: "manutencao.reserva_assumiu", em: agora(), autor: null, dados: { motivo, horas: l.responderHoras, canal: "WHATSAPP" } });
}

const situacaoLink = (l: LinkFalso, m: EstadoManutencao) => {
  const estado = m.manutencoes.find((x) => x.id === l.manutencaoId)?.estado;
  if (l.revogado) return "CANCELADO";
  if (estado === "CONCLUIDA") return "CONCLUIDA";
  if (estado === "CANCELADA") return "MANUTENCAO_CANCELADA";
  return l.expiraEm < agora() ? "VENCIDO" : "VALE";
};

/** Sem conta: a etiqueta e o link do prestador. */
export async function rotasLinksPublicas(route: Route, est: EstadoLinks, man: EstadoManutencao, caminho: string, metodo: string,
  corpo: Record<string, unknown>): Promise<unknown> {
  const et = /^\/v1\/publico\/etiqueta\/([^/]+)$/.exec(caminho);
  if (et) {
    const e = est.etiquetas.find((x) => x.codigo === decodeURIComponent(et[1]!).toUpperCase());
    if (!e) return erro(route, 404, "NOT_FOUND");
    if (!e.ativa) return route.fulfill({ json: { condominio: "Residencial Ipê", foraDeUso: true } });
    e.aberturas++;
    const j = etiquetaJson(e);
    return route.fulfill({ json: { condominio: "Residencial Ipê", local: e.local, rotulo: j.rotulo, recado: j.recado, recadoEm: j.recado ? e.recadoEm : undefined,
      whatsapp: est.numero?.replace("+", ""), canalAlternativo: est.canalAlternativo } });
  }
  const p = /^\/v1\/publico\/p\/([^/]+)(\/[^]*)?$/.exec(caminho);
  if (!p) return null;
  const l = est.links.find((x) => x.codigo === p[1]);
  if (!l) return erro(route, 404, "NOT_FOUND");
  const m = man.manutencoes.find((x) => x.id === l.manutencaoId)!;
  const sit = situacaoLink(l, man);
  const resto = p[2] ?? "";
  if (resto === "" && metodo === "GET") {
    if (sit !== "VALE") return route.fulfill({ json: { condominio: "Residencial Ipê", encerrado: true, motivo: l.trocaResultado === "TROCOU" ? "REPASSADO" : sit } });
    l.abertoEm ??= agora();
    return route.fulfill({ json: {
      condominio: "Residencial Ipê", para: l.para, tipo: m.tipo, titulo: m.titulo, local: m.local, oQueFazer: l.oQueFazer, quando: l.quando ?? undefined,
      comoEntrar: l.comoEntrar ?? undefined, expiraEm: l.expiraEm, arquivos: [], pedido: l.noRegistro?.protocolo,
      responderAte: l.respondidoEm ? undefined : l.responderAte, resposta: l.resposta,
      registros: est.registros.filter((r) => r.linkId === l.id).map((r) => ({ tipo: r.tipo, confirmado: r.confirmado, em: r.em, etiqueta: r.etiqueta?.rotulo })),
    } });
  }
  if (sit !== "VALE") return erro(route, 400, "VALIDATION_ERROR", { motivo: "LINK_ENCERRADO" });
  if (resto === "/confirmar" || resto === "/recusar") {
    if (l.respondidoEm) {
      return resto === "/confirmar" ? route.fulfill({ json: { ok: true, resposta: l.resposta } }) : erro(route, 400, "VALIDATION_ERROR", { motivo: "JA_RESPONDIDO" });
    }
    const texto = String(corpo.texto ?? "").trim();
    if (resto === "/recusar" && texto && texto.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
    Object.assign(l, { respondidoEm: agora(), resposta: resto === "/confirmar" ? "CONFIRMOU" : "RECUSOU" });
    m.historico.unshift({ acao: resto === "/confirmar" ? "manutencao.prestador_confirmou" : "manutencao.prestador_recusou", em: agora(), autor: null, dados: {} });
    if (resto === "/recusar" && l.reservaId) trocarParaReserva(est, man, l, "RECUSOU");
    return route.fulfill({ json: { ok: true, resposta: l.resposta } });
  }
  if (resto === "/chegada") {
    if (!l.respondidoEm) Object.assign(l, { respondidoEm: agora(), resposta: "CHEGOU" });
    const e = est.etiquetas.find((x) => x.ativa && x.codigo === corpo.etiqueta);
    const confirmado = !!e && e.local === m.local;
    est.registros.unshift({ id: novoId(), linkId: l.id, manutencaoId: m.id, tipo: "CHEGOU", confirmado, etiqueta: e ? { rotulo: rotulo(e.numero), local: e.local } : undefined,
      em: agora(), fotos: [] });
    return route.fulfill({ json: { confirmado, em: agora(), etiqueta: e ? { rotulo: rotulo(e.numero), local: e.local } : undefined, etiquetaLida: !!corpo.etiqueta } });
  }
  if (resto === "/fotos" && metodo === "POST") {
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(corpo.tipo))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO" });
    const id = novoId();
    est.fotos.push({ id, nome: String(corpo.nome), tipo: String(corpo.tipo), linkId: l.id, situacao: "ENVIANDO" });
    return route.fulfill({ status: 201, json: { arquivoId: id, envio: { url: `/api/v1/armazenamento/${id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  const v = /^\/fotos\/([^/]+)\/verificar$/.exec(resto);
  if (v) {
    const f = est.fotos.find((x) => x.id === v[1] && x.linkId === l.id);
    if (!f) return erro(route, 404, "NOT_FOUND");
    const motivo = conferir(conteudoEnviado(f.id), f.tipo);
    f.situacao = motivo ? "NAO_LIBERADO" : "LIBERADO";
    return route.fulfill({ json: motivo ? { situacao: f.situacao, motivo } : { situacao: f.situacao } });
  }
  if (resto === "/impedimento" || resto === "/terminei") {
    if (String(corpo.texto ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
    if (resto === "/impedimento" && !corpo.impedimento) return erro(route, 400, "VALIDATION_ERROR", { campos: ["impedimento"] });
    if (resto === "/terminei" && String(corpo.quemFez ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["quemFez"] });
    if (resto === "/terminei" && corpo.ficouPendente && String(corpo.pendenteTexto ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["pendenteTexto"] });
    const fotos = (corpo.fotos as string[] | undefined) ?? [];
    est.registros.unshift({
      id: novoId(), linkId: l.id, manutencaoId: m.id, tipo: resto === "/impedimento" ? "IMPEDIMENTO" : "TERMINOU", impedimento: corpo.impedimento as string | undefined,
      texto: String(corpo.texto).trim(), ficouPendente: resto === "/terminei" ? Boolean(corpo.ficouPendente) : undefined,
      pendenteTexto: (corpo.pendenteTexto as string) || undefined, quemFez: (corpo.quemFez as string) || undefined, em: agora(), fotos,
    });
    m.historico.unshift({ acao: resto === "/impedimento" ? "manutencao.prestador_impedimento" : "manutencao.prestador_terminou", em: agora(), autor: null,
      dados: { texto: String(corpo.texto).trim() } });
    return route.fulfill({ json: { ok: true, em: agora() } });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** Com sessão: Configurações › Links e QR, os locais e o link do prestador na manutenção. */
export async function rotasLinks(route: Route, est: EstadoLinks, man: EstadoManutencao, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (caminho === "/v1/condominio/locais") return route.fulfill({ json: est.etiquetas.filter((e) => e.ativa).map((e) => e.local).sort() });
  if (caminho === "/v1/condominio/links-qr") {
    if (!pode("config.ver")) return erro(route, 403, "FORBIDDEN");
    const validos = est.links.filter((l) => situacaoLink(l, man) === "VALE");
    return route.fulfill({ json: {
      numeroWhatsapp: est.numero ?? undefined, mural: { ligado: true, aberturas: 214 },
      etiquetas: [...est.etiquetas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.numero - b.numero).map(etiquetaJson),
      prestador: { validos: validos.length, venceEm: validos[0]?.expiraEm,
        links: validos.map((l) => ({ id: l.id, manutencaoId: l.manutencaoId, titulo: man.manutencoes.find((m) => m.id === l.manutencaoId)?.titulo, para: l.para, expiraEm: l.expiraEm })) },
      documentos: { validos: 5 }, podeEditar: pode("config.editar"),
    } });
  }
  const e = /^\/v1\/condominio\/etiquetas(?:\/([^/]+))?(\/trocar-codigo|\/desativar)?$/.exec(caminho);
  if (e) {
    const atual = e[1] ? est.etiquetas.find((x) => x.id === e[1]) : undefined;
    if (e[1] && !atual) return erro(route, 404, "NOT_FOUND");
    if (metodo === "GET" && atual) return route.fulfill({ json: { etiqueta: etiquetaJson(atual), historico: atual.historico, podeEditar: pode("config.editar") && atual.ativa } });
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (atual && corpo.versao !== atual.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: atual.versao });
    const hist = (acao: string, dados: Record<string, unknown>) => atual!.historico.unshift({ acao, em: agora(), autor: eu.nome, dados });
    if (e[2]) {
      if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      atual!.versao++;
      if (e[2] === "/trocar-codigo") { atual!.codigo = "MNPQ-RSTU-VWXY"; hist("etiqueta.codigo_trocado", { motivo: corpo.motivo }); return route.fulfill({ json: { versao: atual!.versao, codigo: atual!.codigo } }); }
      atual!.ativa = false; atual!.motivoDesativacao = String(corpo.motivo); hist("etiqueta.desativada", { motivo: corpo.motivo });
      return route.fulfill({ json: { versao: atual!.versao } });
    }
    const local = String(corpo.local ?? "").trim();
    if (local.length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["local"] });
    if (corpo.recado && !corpo.recadoAte) return erro(route, 400, "VALIDATION_ERROR", { campos: ["recadoAte"] });
    if (est.etiquetas.some((x) => x.ativa && x.id !== atual?.id && x.local.toLowerCase() === local.toLowerCase())) {
      return erro(route, 400, "VALIDATION_ERROR", { motivo: "LOCAL_REPETIDO" });
    }
    const dados = { local, onde: (corpo.onde as string) || null, recado: (corpo.recado as string) || null, recadoAte: (corpo.recado as string) ? String(corpo.recadoAte) : null,
      recadoEm: (corpo.recado as string) ? agora() : null };
    if (atual) {
      Object.assign(atual, dados, { versao: atual.versao + 1 });
      if (dados.recado) hist("etiqueta.recado", { recado: dados.recado, ate: dados.recadoAte });
      return route.fulfill({ json: { id: atual.id, versao: atual.versao } });
    }
    const nova: EtiquetaFalsa = { id: novoId(), numero: Math.max(...est.etiquetas.map((x) => x.numero)) + 1, codigo: "HJKM-NPQR-ST67", ativa: true,
      motivoDesativacao: null, aberturas: 0, versao: 1, historico: [{ acao: "etiqueta.criada", em: agora(), autor: eu.nome, dados: { local } }], ...dados };
    est.etiquetas.push(nova);
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }

  const lp = /^\/v1\/condominio\/manutencao\/([^/]+)\/(link-prestador|fotos-prestador)(?:\/([^/]+)\/(envio|cancelar|link|nao-trocar))?$/.exec(caminho);
  if (!lp) return null;
  const m = man.manutencoes.find((x) => x.id === lp[1]);
  if (!m || !pode("manutencao.ver")) return erro(route, 404, "NOT_FOUND");
  const prestador = man.prestadores.find((p) => p.id === m.prestadorId);
  const ultimo = est.links.filter((l) => l.manutencaoId === m.id).at(-1);
  if (lp[2] === "fotos-prestador") return route.fulfill({ json: { url: `/api/v1/armazenamento/${lp[3]}`, tipo: "image/png", expiraEm: agora() } });
  if (!lp[3] && metodo === "GET") {
    const etq = est.etiquetas.find((x) => x.ativa && x.local === m.local);
    const aberta = m.estado !== "CONCLUIDA" && m.estado !== "CANCELADA";
    return route.fulfill({ json: {
      link: ultimo ? { id: ultimo.id, para: ultimo.para, oQueFazer: ultimo.oQueFazer, quando: ultimo.quando ?? undefined, expiraEm: ultimo.expiraEm,
        abertoEm: ultimo.abertoEm ?? undefined, criadoEm: ultimo.criadoEm, criadoPor: "Ana Souza", situacao: situacaoLink(ultimo, man),
        motivoCancelamento: ultimo.revogado ?? undefined, responderAte: ultimo.responderAte, responderHoras: ultimo.responderHoras,
        respondidoEm: ultimo.respondidoEm, resposta: ultimo.resposta, trocaDesligadaEm: ultimo.trocaDesligadaEm, trocaResultado: ultimo.trocaResultado,
        trocadoEm: ultimo.trocadoEm, trocaDe: ultimo.trocaDe ? { nome: ultimo.trocaDe } : undefined,
        reserva: ultimo.reservaId ? { id: ultimo.reservaId, nome: man.prestadores.find((p) => p.id === ultimo.reservaId)!.nome } : undefined,
        prazoNoEnvio: ultimo.responderAte ? undefined : ultimo.prazoNoEnvio,
        reservaNoEnvio: !ultimo.responderAte && ultimo.reservaNoEnvio ? { id: ultimo.reservaNoEnvio, nome: man.prestadores.find((p) => p.id === ultimo.reservaNoEnvio)!.nome } : undefined,
        noRegistro: ultimo.noRegistro } : undefined,
      reservaDoCadastro: ((r) => (r ? { id: r.id, nome: r.nome } : undefined))(man.prestadores.find((p) => p.id === prestador?.reservaId && !p.arquivado)),
      registros: est.registros.filter((r) => r.manutencaoId === m.id).map((r) => ({ ...r, fotos: r.fotos.length })),
      fotos: est.registros.filter((r) => r.manutencaoId === m.id).flatMap((r) => r.fotos.map((f) => ({ id: f, nome: est.fotos.find((x) => x.id === f)?.nome ?? "foto", registroId: r.id, enviadoEm: r.em }))),
      para: prestador ? { nome: prestador.nome, telefone: prestador.telefone ?? undefined, email: prestador.email ?? undefined } : m.executorTexto ? { nome: m.executorTexto } : undefined,
      local: m.local, sugestao: { oQueFazer: `${m.titulo}. Local: ${m.local}.` },
      etiqueta: etq ? { rotulo: rotulo(etq.numero), local: etq.local } : undefined, arquivos: [],
      pode: { mandar: pode("manutencao.editar") && aberta && (!!prestador || !!m.executorTexto), cancelar: pode("manutencao.editar") && !!ultimo && !ultimo.revogado,
        naoTrocar: pode("manutencao.editar") && !!ultimo?.reservaId && !ultimo.trocadoEm && !ultimo.trocaDesligadaEm && !ultimo.revogado && !ultimo.respondidoEm },
      semExecutor: !prestador && !m.executorTexto ? true : undefined,
    } });
  }
  if (!pode("manutencao.editar")) return erro(route, 403, "FORBIDDEN");
  if (!lp[3]) {
    if (String(corpo.oQueFazer ?? "").trim().length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["oQueFazer"] });
    if (corpo.versao !== m.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: m.versao });
    for (const l of est.links.filter((x) => x.manutencaoId === m.id && !x.revogado)) l.revogado = "Mandado um link novo";
    const l: LinkFalso = { id: novoId(), manutencaoId: m.id, para: prestador?.nome ?? m.executorTexto ?? "", oQueFazer: String(corpo.oQueFazer).trim(),
      quando: (corpo.quando as string) || null, comoEntrar: (corpo.comoEntrar as string) || null, expiraEm: `${String(corpo.valeAte)}T23:59:59-03:00`,
      abertoEm: null, criadoEm: agora(), codigo: PRESTADOR_FALSO, revogado: null };
    if (corpo.responderHoras !== null && corpo.responderHoras !== undefined) {
      if (![4, 8, 24, 48].includes(Number(corpo.responderHoras)) || !prestador?.reservaId) return erro(route, 400, "VALIDATION_ERROR", { campos: ["responderHoras"] });
      Object.assign(l, { responderHoras: Number(corpo.responderHoras), reservaId: prestador.reservaId,
        responderAte: new Date(Date.now() + Number(corpo.responderHoras) * 3600_000).toISOString() });
    }
    est.links.push(l);
    m.versao++;
    m.historico.unshift({ acao: "manutencao.link_prestador", em: agora(), autor: eu.nome, dados: { para: l.para, ate: corpo.valeAte } });
    if (l.reservaId) m.historico.unshift({ acao: "manutencao.reserva_programada", em: agora(), autor: eu.nome, dados: { horas: l.responderHoras } });
    return route.fulfill({ status: 201, json: { id: l.id, codigo: l.codigo, versao: m.versao, expiraEm: l.expiraEm } });
  }
  const l = est.links.find((x) => x.id === lp[3]);
  if (!l) return erro(route, 404, "NOT_FOUND");
  if (lp[4] === "envio") return route.fulfill({ json: { ok: true } });
  if (lp[4] === "nao-trocar") {
    if (!l.reservaId || l.trocadoEm || l.trocaDesligadaEm) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_TROCA" });
    l.trocaDesligadaEm = agora();
    m.historico.unshift({ acao: "manutencao.reserva_desligada", em: agora(), autor: eu.nome, dados: {} });
    return route.fulfill({ json: { ok: true } });
  }
  if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
  l.revogado = String(corpo.motivo).trim();
  return route.fulfill({ json: { ok: true } });
}

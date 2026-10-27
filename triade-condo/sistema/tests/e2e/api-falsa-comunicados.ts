// Parte de comunicados e documentos da API falsa da Plataforma (peça R1). As regras de verdade
// estão testadas no banco (pgTAP 016) e na API (Deno); aqui só o bastante para a tela: lista com
// atalhos, escrever com o público calculado, publicar, programar, corrigir em versão nova,
// arquivar, copiar, plano de comunicação e documentos com versões. O comunicado pelo WhatsApp do
// condomínio (F6.6): o cartão de Configurações, a conta por canal e como chegou (pgTAP 033).
import type { Route } from "@playwright/test";
import { hojeFalso, somar } from "./api-falsa-agenda";
import { conferir, conteudoEnviado } from "./api-falsa-arquivos";
import { recebeNoWhatsapp, type EstadoMoradores } from "./api-falsa-moradores";

let n = 0;
const novoId = () => `8f9a0b1c-2d3e-4f4a-9b5c-${String(++n).padStart(12, "0")}`;

type Historico = { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
interface ComunicadoFalso {
  id: string; familiaId: string; numero: number; assunto: string; titulo: string; texto: string; publico: string;
  blocos: string[]; unidades: string[]; contatos: string[]; pedidoId: string | null; manutencaoId: string | null; estado: string;
  programadoPara: string | null; publicadoEm: string | null; publicadoPor: string | null; destinatarios: number | null; assinatura: string | null;
  mudanca: string | null; substituidoEm: string | null; arquivamento: { motivo: string; em: string; por: string } | null;
  autor: string; criadoEm: string; atualizadoEm: string; versao: number;
  /** Mural online e e-mail (CD-12, CD-13). */
  noMural?: boolean; porEmail?: boolean; emails?: number;
  /** Comunicado pelo WhatsApp (F6.6): mensagens que saíram e as que não chegaram. */
  porWhatsapp?: boolean; whatsapps?: number; whatsappFalhas?: { contatoId: string; motivo: string }[];
  /** Dia, hora e local do aviso com evento (CD-17). */
  evento?: EventoFalso | null;
}
type EventoFalso = { dia: string; inicio?: string; fim?: string; local?: string };
interface PedidoDocFalso { id: string; documentoId: string; email: string; contato?: { id: string; nome: string; unidades: string }; estado: string;
  automatico: boolean; criadoEm: string; motivo?: string }
interface EnvioDocFalso { id: string; documentoId: string; para: string; contato?: string; criadoEm: string; cancelado: boolean; pedido: boolean }
interface ArquivoFalso { id: string; familiaId: string; nome: string; tipo: string; tamanho: number; situacao: string; motivoRecusa?: string; enviadoEm: string }
interface VersaoFalsa {
  id: string; numero?: number; mudanca?: string; vigenteDesde: string; aprovadoEm?: string; nome: string; tipo: string; tamanho: number;
  situacao: string; motivoRecusa?: string; enviadoEm: string; enviadoPor: string;
}
interface DocumentoFalso {
  id: string; tipo: string; titulo: string; descricao: string | null; restrito: boolean; aoMorador: boolean; valeAte: string | null;
  arquivado: { motivo: string; em: string; por: string } | null; criadoEm: string; versao: number; versoes: VersaoFalsa[]; historico: Historico;
}

export interface EstadoComunicados {
  comunicados: ComunicadoFalso[];
  arquivos: ArquivoFalso[];
  historico: Map<string, Historico>;
  documentos: DocumentoFalso[];
  plano: { assuntos: string[]; plano: string | null; assinatura: string | null; silencioInicio: string; silencioFim: string; versao: number };
  mural: { ligado: boolean; codigo: string; assuntos: string[]; aberturas: number; emailLigado: boolean; responderPara: string | null;
    documentosNoMural: boolean; documentosAutomatico: boolean; codigosAntigos: string[] };
  pedidosDoc: PedidoDocFalso[];
  enviosDoc: EnvioDocFalso[];
}

/** Os códigos do mural e dos links do e-mail que a API falsa reconhece. */
export const MURAL_FALSO = "7KQ2-X9MP-4WD8";
export const LINK_FALSO = "Zm9vYmFyYmF6cXV4LWNvZGlnby1kZS10ZXN0ZQ";

/** O Residencial Ipê: a falta de água publicada, um rascunho parado, o regimento em vigor e o AVCB perto de vencer (restrito). */
export function criarComunicados(pedidoId: string): EstadoComunicados {
  const agora = Date.now();
  const h = hojeFalso();
  const iso = (ms: number) => new Date(ms).toISOString();
  const agua = novoId();
  const rascunho = novoId();
  const festa = novoId();
  const coleta = novoId();
  const c = (x: Partial<ComunicadoFalso> & { id: string; titulo: string }): ComunicadoFalso => ({
    familiaId: x.id, numero: 1, assunto: "OBRAS", texto: "A água será desligada das 9h às 13h para a troca da bomba.", publico: "TODOS", blocos: [], unidades: [], contatos: [],
    pedidoId: null, manutencaoId: null, estado: "RASCUNHO", programadoPara: null, publicadoEm: null, publicadoPor: null, destinatarios: null, assinatura: null,
    mudanca: null, substituidoEm: null, arquivamento: null, autor: "Ana Souza", criadoEm: iso(agora - 2 * 86400_000), atualizadoEm: iso(agora - 2 * 86400_000), versao: 1, ...x,
  });
  const regimento = novoId();
  const avcb = novoId();
  return {
    comunicados: [
      c({ id: agua, titulo: "Falta de água na quinta", estado: "PUBLICADO", publicadoEm: iso(agora - 86400_000), publicadoPor: "Ana Souza", destinatarios: 3,
        assinatura: "Ana, síndica do Residencial Ipê", pedidoId, noMural: true, porEmail: true, emails: 1, porWhatsapp: true, whatsapps: 2 }),
      c({ id: rascunho, titulo: "Assembleia geral ordinária: convocação", assunto: "ASSEMBLEIA", texto: "Convocamos todos para a assembleia.",
        atualizadoEm: iso(agora - 4 * 86400_000) }),
      c({ id: festa, titulo: "Festa das crianças no salão", assunto: "AVISO", texto: "Brincadeiras, pipoca e algodão-doce. Cada família leva um prato.",
        estado: "PUBLICADO", publicadoEm: iso(agora - 2 * 86400_000), publicadoPor: "Ana Souza", destinatarios: 3, assinatura: "Comissão de festas",
        criadoEm: iso(agora - 2 * 86400_000), atualizadoEm: iso(agora - 2 * 86400_000), noMural: true, porEmail: true, emails: 1,
        evento: { dia: somar(h, 5), inicio: "16:00", local: "Salão de festas" } }),
      c({ id: coleta, titulo: "Coleta de recicláveis às quartas", assunto: "LEMBRETE", texto: "Deixe os recicláveis limpos e secos no abrigo até as 7h.",
        estado: "PUBLICADO", publicadoEm: iso(agora - 10 * 86400_000), publicadoPor: "Ana Souza", destinatarios: 3,
        criadoEm: iso(agora - 10 * 86400_000), atualizadoEm: iso(agora - 10 * 86400_000), noMural: true, porEmail: true, emails: 1 }),
    ],
    arquivos: [],
    historico: new Map([[agua, [{ acao: "comunicado.publicado", em: iso(agora - 86400_000), autor: "Ana Souza", dados: { numero: 1 } }]],
      [rascunho, [{ acao: "comunicado.escrito", em: iso(agora - 4 * 86400_000), autor: "Ana Souza", dados: {} }]],
      [festa, [{ acao: "comunicado.publicado", em: iso(agora - 2 * 86400_000), autor: "Ana Souza", dados: { numero: 1 } }]],
      [coleta, [{ acao: "comunicado.publicado", em: iso(agora - 10 * 86400_000), autor: "Ana Souza", dados: { numero: 1 } }]]]),
    documentos: [
      { id: regimento, tipo: "REGIMENTO", titulo: "Regimento interno", descricao: null, restrito: false, aoMorador: true, valeAte: null, arquivado: null,
        criadoEm: iso(agora - 30 * 86400_000), versao: 1, historico: [],
        versoes: [{ id: novoId(), numero: 1, vigenteDesde: "2025-04-12", aprovadoEm: "AGE de 05/04/2025", nome: "regimento-v1.pdf", tipo: "application/pdf",
          tamanho: 1_800_000, situacao: "LIBERADO", enviadoEm: iso(agora - 30 * 86400_000), enviadoPor: "Ana Souza" }] },
      { id: avcb, tipo: "LAUDO", titulo: "AVCB", descricao: "Auto de vistoria do Corpo de Bombeiros", restrito: true, aoMorador: false, valeAte: somar(h, 42),
        arquivado: null, criadoEm: iso(agora - 30 * 86400_000), versao: 1, historico: [], versoes: [] },
    ],
    plano: { assuntos: ["AVISO", "OBRAS", "SEGURANCA", "ASSEMBLEIA", "LEMBRETE"], plano: null, assinatura: "Ana, síndica do Residencial Ipê",
      silencioInicio: "21:00", silencioFim: "08:00", versao: 1 },
    mural: { ligado: true, codigo: MURAL_FALSO, assuntos: ["AVISO", "OBRAS", "ASSEMBLEIA", "LEMBRETE"], aberturas: 214, emailLigado: true,
      responderPara: null, documentosNoMural: true, documentosAutomatico: true, codigosAntigos: [] },
    pedidosDoc: [{ id: novoId(), documentoId: regimento, email: "imobiliaria@exemplo.com.br", estado: "ESPERANDO", automatico: false, criadoEm: iso(agora - 3600_000) }],
    enviosDoc: [],
  };
}

const publicoDe = (est: EstadoComunicados) => (c: ComunicadoFalso) => ({ id: c.id, assunto: c.assunto, titulo: c.titulo, texto: c.texto,
  assinatura: c.assinatura ?? undefined, publicadoEm: c.publicadoEm, numero: c.numero, mudanca: c.mudanca ?? undefined, evento: c.evento ?? undefined,
  arquivos: est.arquivos.filter((a) => a.familiaId === c.familiaId && a.situacao === "LIBERADO").map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo })) });
const doMural = (est: EstadoComunicados) => est.comunicados.filter((c) => c.estado === "PUBLICADO" && c.noMural && c.publico === "TODOS");
const docsDoMural = (est: EstadoComunicados) =>
  est.documentos.filter((d) => d.aoMorador && !d.restrito && !d.arquivado && d.versoes.some((v) => v.situacao === "LIBERADO"));

/** O mural como o morador vê: o mesmo para o link e para a prévia do painel (CD-15). */
export function muralFalso(est: EstadoComunicados, manual: () => unknown[] = () => [], extra: () => Record<string, unknown> = () => ({}),
  zap?: EstadoMoradores["zap"]) {
  const mu = est.mural;
  const lista = doMural(est).sort((a, b) => String(b.publicadoEm).localeCompare(String(a.publicadoEm)));
  return { condominio: "Residencial Ipê", comunicados: lista.map(publicoDe(est)),
    documentos: mu.documentosNoMural && mu.emailLigado ? docsDoMural(est).map((d) => ({ id: d.id, titulo: d.titulo, tipo: d.tipo })) : [],
    manual: manual(), ...extra(), ...(zap?.ligado ? { comunicadosWhatsapp: zap.numero } : {}), atualizadoEm: lista[0]?.publicadoEm };
}

/** O mural no painel (CD-15): a prévia não conta abertura; vem o que ficou de fora e o motivo. */
export function muralNoPainelFalso(est: EstadoComunicados, pode: (a: string) => boolean, manual: () => unknown[], extra: () => Record<string, unknown>,
  zap?: EstadoMoradores["zap"]) {
  const mu = est.mural;
  const fora = est.comunicados.filter((c) => c.estado === "PUBLICADO" && !(c.noMural && c.publico === "TODOS"))
    .sort((a, b) => String(b.publicadoEm).localeCompare(String(a.publicadoEm))).slice(0, 30)
    .map((c) => ({ id: c.id, titulo: c.titulo, assunto: c.assunto, publicadoEm: c.publicadoEm, versao: c.versao,
      motivo: c.publico !== "TODOS" ? "SO_PARA_ALGUNS" : !mu.assuntos.includes(c.assunto) ? "ASSUNTO_FORA" : "TIRADO" }));
  return { ligado: mu.ligado, ...(mu.ligado ? { codigo: mu.codigo, mural: muralFalso(est, manual, extra, zap) } : {}), aberturas: mu.aberturas,
    versoes: Object.fromEntries(doMural(est).map((c) => [c.id, c.versao])), fora,
    pode: { mural: pode("comunicados.publicar"), configurar: pode("config.ver"), classificados: pode("classificados.ver") } };
}

/** Sem conta (CD-12 a CD-14): o mural, os links do e-mail e o pedido de documento. */
export async function rotasPublicas(route: Route, est: EstadoComunicados, caminho: string, metodo: string, corpo: Record<string, unknown>,
  manual: () => unknown[] = () => [], extra: () => Record<string, unknown> = () => ({}), zap?: EstadoMoradores["zap"]): Promise<unknown> {
  if (!caminho.startsWith("/v1/publico/")) return null;
  const mu = est.mural;
  const botao = zap?.ligado ? { comunicadosWhatsapp: zap.numero } : {};
  const pub = publicoDe(est);
  const docs = () => docsDoMural(est);
  const m = /^\/v1\/publico\/mural\/([^/]+)(\/documentos|\/comunicados\/([^/]+)\/arquivos\/([^/]+))?$/.exec(caminho);
  if (m) {
    const codigo = decodeURIComponent(m[1]!).toUpperCase();
    if (mu.codigosAntigos.includes(codigo)) return route.fulfill({ json: { condominio: "Residencial Ipê", trocado: true } });
    if (codigo !== mu.codigo) return erro(route, 404, "NOT_FOUND");
    if (!mu.ligado) return route.fulfill({ json: { condominio: "Residencial Ipê", foraDoAr: true } });
    if (m[2] === "/documentos") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(corpo.email ?? ""))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["email"] });
      const d = docs().find((x) => x.id === corpo.documentoId);
      if (d) est.pedidosDoc.unshift({ id: novoId(), documentoId: d.id, email: String(corpo.email), estado: "ESPERANDO", automatico: false, criadoEm: new Date().toISOString() });
      return route.fulfill({ json: { ok: true } });
    }
    if (m[3]) return route.fulfill({ json: { url: `/api/v1/armazenamento/${m[4]}`, nome: "foto", tipo: "image/jpeg" } });
    mu.aberturas++;
    return route.fulfill({ json: muralFalso(est, manual, extra, zap) });
  }
  const c = /^\/v1\/publico\/c\/([^/]+)(?:\/arquivos\/([^/]+))?$/.exec(caminho);
  if (c) {
    if (c[1] !== LINK_FALSO) return erro(route, 400, "VALIDATION_ERROR", { motivo: "LINK_VENCIDO" });
    if (c[2]) return route.fulfill({ json: { url: `/api/v1/armazenamento/${c[2]}`, nome: "foto", tipo: "image/jpeg" } });
    const agua = est.comunicados.filter((x) => x.estado === "PUBLICADO")[0];
    return route.fulfill({ json: agua ? { condominio: "Residencial Ipê", comunicado: pub(agua), ...botao } : { condominio: "Residencial Ipê", foraDeUso: true } });
  }
  const e = /^\/v1\/publico\/email\/(confirmar|parar|voltar)$/.exec(caminho);
  if (e && metodo === "POST") {
    if (corpo.codigo !== LINK_FALSO) return erro(route, 400, "VALIDATION_ERROR", { motivo: "LINK_VENCIDO" });
    if (e[1] === "confirmar") return route.fulfill({ json: { nome: "Joana Lima", email: "joana@exemplo.com.br", condominio: "Residencial Ipê" } });
    return route.fulfill({ json: { condominio: "Residencial Ipê", parou: e[1] === "parar" } });
  }
  const d = /^\/v1\/publico\/d\/([^/]+)$/.exec(caminho);
  if (d) {
    if (d[1] !== LINK_FALSO) return erro(route, 400, "VALIDATION_ERROR", { motivo: "LINK_VENCIDO" });
    return route.fulfill({ json: { url: "/api/v1/armazenamento/regimento", nome: "regimento.pdf", tipo: "application/pdf", titulo: "Regimento interno", numero: 1,
      condominio: "Residencial Ipê" } });
  }
  return erro(route, 404, "NOT_FOUND");
}

export function resumoComunicados(est: EstadoComunicados, pode: (a: string) => boolean) {
  const h = hojeFalso();
  const parados = est.comunicados.filter((c) => c.estado === "RASCUNHO" && Date.parse(c.atualizadoEm) < Date.now() - 3 * 86400_000);
  const hoje = est.comunicados.filter((c) => c.estado === "PROGRAMADO" && c.programadoPara && new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date(c.programadoPara)) === h);
  const vencendo = est.documentos.filter((d) => !d.arquivado && d.valeAte && d.valeAte <= somar(h, 60) && (!d.restrito || pode("documentos.restritos")));
  return {
    ...(pode("comunicados.ver") ? { programadosHoje: hoje.length, rascunhosParados: parados.length,
      ...(parados[0] ? { rascunhoMaisAntigo: { id: parados[0].id, titulo: parados[0].titulo, desde: parados[0].atualizadoEm } } : {}),
      ...(hoje[0] ? { proximoProgramado: { id: hoje[0].id, titulo: hoje[0].titulo, em: hoje[0].programadoPara } } : {}) } : {}),
    documentosVencendo: vencendo.length,
    ...(vencendo[0] ? { documentoMaisProximo: { id: vencendo[0].id, titulo: vencendo[0].titulo, valeAte: vencendo[0].valeAte } } : {}),
  };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export async function rotasComunicados(route: Route, est: EstadoComunicados, ctx: {
  moradores: EstadoMoradores; pedidos: { id: string; protocolo: string; assunto: string; estado: string }[]; eu: { nome: string };
}, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean): Promise<unknown> {
  const ligado = /^\/v1\/condominio\/(pedidos|manutencao)\/([^/]+)\/comunicados$/.exec(caminho);
  if (!caminho.startsWith("/v1/condominio/comunicados") && !caminho.startsWith("/v1/condominio/documentos")
    && caminho !== "/v1/condominio/plano-comunicacao" && caminho !== "/v1/condominio/mural-email" && caminho !== "/v1/condominio/mural/trocar-link"
    && caminho !== "/v1/condominio/whatsapp/comunicados" && !ligado) return null;
  const agora = new Date().toISOString();
  const h = hojeFalso();
  const m = ctx.moradores;
  const nomeUnidade = (id: string) => {
    const u = m.unidades.find((x) => x.id === id)!;
    const b = m.blocos.find((x) => x.id === u.blocoId);
    return b ? `${b.nome} · ${u.identificacao}` : u.identificacao;
  };
  const comEmail = (contatoId: string) => {
    const x = m.contatos.find((y) => y.id === contatoId) as { emailSituacao?: string; emailComunicados?: boolean } | undefined;
    return x?.emailSituacao === "CONFIRMADO" && x.emailComunicados !== false;
  };
  const destinatarios = (assunto: string, publico: string, blocos: string[], unidades: string[], contatos: string[]) =>
    m.vinculos.filter((v) => v.estado === "CONFIRMADO" && (v.recebeComunicados || (assunto === "ASSEMBLEIA" && v.relacao === "PROPRIETARIO"))
      && (publico === "TODOS" || (publico === "BLOCOS" && blocos.includes(m.unidades.find((u) => u.id === v.unidadeId)?.blocoId ?? ""))
        || (publico === "UNIDADES" && unidades.includes(v.unidadeId)) || (publico === "CONTATOS" && contatos.includes(v.contatoId))));
  const zap = m.zap;
  const comWhatsapp = (contatoId: string) => zap.ligado && recebeNoWhatsapp(m.contatos.find((y) => y.id === contatoId) ?? {});
  const calcular = (assunto: string, publico: string, blocos: string[], unidades: string[], contatos: string[]) => {
    const d = destinatarios(assunto, publico, blocos, unidades, contatos);
    const ids = [...new Set(d.map((v) => v.contatoId))];
    const escopo = m.unidades.filter((u) => u.ativa && publico !== "CONTATOS"
      && (publico === "TODOS" || (publico === "BLOCOS" && blocos.includes(u.blocoId ?? "")) || (publico === "UNIDADES" && unidades.includes(u.id))));
    return {
      contatos: new Set(d.map((v) => v.contatoId)).size, unidades: new Set(d.map((v) => v.unidadeId)).size,
      semNinguem: escopo.filter((u) => !destinatarios(assunto, "UNIDADES", [], [u.id], []).length).map((u) => ({ id: u.id, nome: nomeUnidade(u.id) })),
      ...(pode("moradores.ver") ? { quem: [...new Set(d.map((v) => v.contatoId))].map((id) => ({ contatoId: id, nome: m.contatos.find((x) => x.id === id)!.nome,
        unidades: d.filter((v) => v.contatoId === id).map((v) => nomeUnidade(v.unidadeId)), email: comEmail(id), whatsapp: comWhatsapp(id) })) } : {}),
      comEmail: new Set(d.filter((v) => comEmail(v.contatoId)).map((v) => v.contatoId)).size,
      comWhatsapp: ids.filter(comWhatsapp).length,
      pelosDois: ids.filter((id) => comWhatsapp(id) && comEmail(id)).length,
    };
  };
  const resumoPublico = (c: ComunicadoFalso) => c.publico === "TODOS" ? "Todo o condomínio"
    : c.publico === "BLOCOS" ? m.blocos.filter((b) => c.blocos.includes(b.id)).map((b) => b.nome).join(", ")
      : c.publico === "UNIDADES" ? `${c.unidades.length} ${c.unidades.length === 1 ? "unidade" : "unidades"}` : `${c.contatos.length} contatos`;
  const json = (c: ComunicadoFalso) => {
    const ped = ctx.pedidos.find((p) => p.id === c.pedidoId);
    return {
      id: c.id, familiaId: c.familiaId, numero: c.numero, assunto: c.assunto, titulo: c.titulo, estado: c.estado, publico: c.publico, publicoResumo: resumoPublico(c),
      destinatarios: c.destinatarios ?? undefined, programadoPara: c.programadoPara ?? undefined, publicadoEm: c.publicadoEm ?? undefined,
      publicadoPor: c.publicadoPor ?? undefined, autor: c.autor, pedido: ped && pode("pedidos.ver") ? { id: ped.id, protocolo: ped.protocolo, assunto: ped.assunto } : undefined,
      substituidoEm: c.substituidoEm ?? undefined, criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm, versao: c.versao, evento: c.evento ?? undefined,
    };
  };
  const hist = (familia: string, acao: string, dados: Record<string, unknown> = {}) => {
    const l = est.historico.get(familia) ?? [];
    l.unshift({ acao, em: agora, autor: ctx.eu.nome, dados });
    est.historico.set(familia, l);
  };
  const publicar = (c: ComunicadoFalso) => {
    c.estado = "PUBLICADO"; c.publicadoEm = agora; c.publicadoPor = ctx.eu.nome; c.assinatura = est.plano.assinatura;
    c.destinatarios = new Set(destinatarios(c.assunto, c.publico, c.blocos, c.unidades, c.contatos).map((v) => v.contatoId)).size;
    hist(c.familiaId, "comunicado.publicado", { numero: c.numero });
    if (est.mural.emailLigado && c.porEmail !== false) {
      c.emails = new Set(destinatarios(c.assunto, c.publico, c.blocos, c.unidades, c.contatos).filter((v) => comEmail(v.contatoId)).map((v) => v.contatoId)).size;
      if (c.emails) hist(c.familiaId, "comunicado.email_na_fila", { numero: c.numero, quantos: c.emails });
    }
    if (zap.ligado && c.porWhatsapp !== false) {
      c.whatsapps = new Set(destinatarios(c.assunto, c.publico, c.blocos, c.unidades, c.contatos).filter((v) => comWhatsapp(v.contatoId)).map((v) => v.contatoId)).size;
      if (c.whatsapps) hist(c.familiaId, "comunicado.whatsapp_na_fila", { numero: c.numero, quantos: c.whatsapps });
    }
  };

  if (caminho === "/v1/condominio/whatsapp/comunicados") {
    if (metodo === "GET") {
      const tel = new Map<string, string>();
      for (const v of m.vinculos.filter((x) => x.estado !== "ENCERRADO")) {
        const x = m.contatos.find((y) => y.id === v.contatoId)!;
        if (x.telefone && (!tel.has(x.telefone) || x.comunicadosWhatsapp === "ACEITOU")) tel.set(x.telefone, x.comunicadosWhatsapp ?? "SEM_RESPOSTA");
      }
      const conta = (s: string) => [...tel.values()].filter((x) => x === s).length;
      return route.fulfill({ json: { ligado: zap.ligado, mudadoEm: zap.mudadoEm ?? undefined, mudadoPor: zap.mudadoPor ?? undefined, versao: zap.versao,
        conectado: zap.conectado, numero: zap.numero,
        contagens: { aceitaram: conta("ACEITOU"), recusaram: conta("RECUSOU"), pararam: conta("PAROU"), semResposta: conta("SEM_RESPOSTA") },
        convite: `Quer receber os comunicados do Residencial Ipê no WhatsApp? Toque no link e envie a mensagem que aparece: https://wa.me/${zap.numero}?text=COMUNICADOS`,
        porMinuto: 10, silencio: { inicio: est.plano.silencioInicio, fim: est.plano.silencioFim }, pode: { editar: pode("config.editar") } } });
    }
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (typeof corpo.ligado !== "boolean") return erro(route, 400, "VALIDATION_ERROR", { campos: ["ligado"] });
    if (corpo.versao !== zap.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: zap.versao });
    if (corpo.ligado && !zap.conectado) return erro(route, 422, "VALIDATION_ERROR", { motivo: "WHATSAPP_DESCONECTADO" });
    Object.assign(zap, { ligado: corpo.ligado, versao: zap.versao + 1, mudadoEm: agora, mudadoPor: ctx.eu.nome });
    return route.fulfill({ json: { versao: zap.versao } });
  }

  if (ligado) {
    if (!pode("comunicados.ver")) return route.fulfill({ json: { podeVer: false, podeEscrever: false, comunicados: [] } });
    const lista = est.comunicados.filter((c) => ["RASCUNHO", "PROGRAMADO", "PUBLICADO"].includes(c.estado)
      && (ligado[1] === "pedidos" ? c.pedidoId === ligado[2] : c.manutencaoId === ligado[2]));
    return route.fulfill({ json: { podeVer: true, podeEscrever: pode("comunicados.publicar"), comunicados: lista.map(json) } });
  }

  if (caminho === "/v1/condominio/mural-email") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== est.plano.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: est.plano.versao });
    Object.assign(est.mural, { ligado: corpo.muralLigado, assuntos: corpo.muralAssuntos, emailLigado: corpo.emailLigado, responderPara: corpo.responderPara || null,
      documentosNoMural: corpo.documentosNoMural, documentosAutomatico: corpo.documentosAutomatico });
    est.plano.versao++;
    return route.fulfill({ json: { versao: est.plano.versao, codigo: est.mural.codigo } });
  }
  if (caminho === "/v1/condominio/mural/trocar-link") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    est.mural.codigosAntigos.push(est.mural.codigo);
    est.mural.codigo = "AB3C-DE4F-GH5J";
    est.plano.versao++;
    return route.fulfill({ json: { versao: est.plano.versao, codigo: est.mural.codigo } });
  }
  if (caminho === "/v1/condominio/plano-comunicacao") {
    const mu = est.mural;
    const ativos = new Set(m.vinculos.filter((v) => v.estado === "CONFIRMADO").map((v) => v.contatoId));
    if (metodo === "GET") return route.fulfill({ json: { ...est.plano, plano: est.plano.plano ?? undefined, podeEditar: pode("config.editar"),
      mural: { ligado: mu.ligado, codigo: mu.codigo, assuntos: mu.assuntos, aberturas: mu.aberturas },
      email: { ligado: mu.emailLigado, responderPara: mu.responderPara ?? undefined, comEmail: [...ativos].filter(comEmail).length, contatos: ativos.size },
      documentos: { noMural: mu.documentosNoMural, automatico: mu.documentosAutomatico } } });
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (!(corpo.assuntos as string[]).length) return erro(route, 400, "VALIDATION_ERROR", { campos: ["assuntos"] });
    Object.assign(est.plano, { assuntos: corpo.assuntos, plano: corpo.plano ?? null, assinatura: corpo.assinatura, silencioInicio: corpo.silencioInicio,
      silencioFim: corpo.silencioFim, versao: est.plano.versao + 1 });
    return route.fulfill({ json: { versao: est.plano.versao } });
  }

  // Documentos.
  if (caminho.startsWith("/v1/condominio/documentos")) {
    if (!pode("documentos.ver")) return erro(route, 403, "FORBIDDEN");
    const visiveis = est.documentos.filter((d) => !d.restrito || pode("documentos.restritos"));
    const vigor = (d: DocumentoFalso) => d.versoes.filter((v) => v.situacao === "LIBERADO" && v.vigenteDesde <= h).sort((a, b) => b.numero! - a.numero!)[0];
    const docJson = (d: DocumentoFalso) => {
      const v = vigor(d);
      const prox = d.versoes.filter((x) => x.situacao === "LIBERADO" && x.vigenteDesde > h).sort((a, b) => b.numero! - a.numero!)[0];
      return { id: d.id, tipo: d.tipo, titulo: d.titulo, descricao: d.descricao ?? undefined, restrito: d.restrito, aoMorador: d.aoMorador, valeAte: d.valeAte ?? undefined,
        vencendo: !!d.valeAte && !d.arquivado && d.valeAte <= somar(h, 60), vencido: !!d.valeAte && d.valeAte < h,
        emVigor: v ? { id: v.id, numero: v.numero, vigenteDesde: v.vigenteDesde, aprovadoEm: v.aprovadoEm, nome: v.nome } : undefined,
        proxima: prox ? { id: prox.id, numero: prox.numero, vigenteDesde: prox.vigenteDesde } : undefined, atualizadoEm: d.criadoEm, versao: d.versao };
    };
    if (caminho === "/v1/condominio/documentos/pedidos") {
      return route.fulfill({ json: { itens: est.pedidosDoc.map((p) => ({ ...p, titulo: est.documentos.find((d) => d.id === p.documentoId)!.titulo })),
        esperando: est.pedidosDoc.filter((p) => p.estado === "ESPERANDO").length, podeDecidir: pode("documentos.editar") } });
    }
    const dec = /^\/v1\/condominio\/documentos\/pedidos\/([^/]+)\/decidir$/.exec(caminho);
    if (dec) {
      const p = est.pedidosDoc.find((x) => x.id === dec[1]);
      if (!p) return erro(route, 404, "NOT_FOUND");
      if (!corpo.enviar && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      p.estado = corpo.enviar ? "ENVIADO" : "RECUSADO";
      if (!corpo.enviar) p.motivo = String(corpo.motivo).trim();
      else est.enviosDoc.unshift({ id: novoId(), documentoId: p.documentoId, para: p.email, criadoEm: agora, cancelado: false, pedido: true });
      return route.fulfill({ json: { estado: p.estado } });
    }
    if (caminho === "/v1/condominio/documentos" && metodo === "GET") {
      const f = url.searchParams.get("filtro") ?? "VIGOR";
      const itens = visiveis.filter((d) => (f === "ARQUIVADOS" ? !!d.arquivado : !d.arquivado) && (f !== "VENCENDO" || (!!d.valeAte && d.valeAte <= somar(h, 60))));
      return route.fulfill({ json: { itens: itens.map(docJson), total: itens.length, pedidosEsperando: est.pedidosDoc.filter((p) => p.estado === "ESPERANDO").length,
        vencendo: visiveis.filter((d) => !d.arquivado && d.valeAte && d.valeAte <= somar(h, 60)).length,
        pode: { editar: pode("documentos.editar"), restritos: pode("documentos.restritos") } } });
    }
    if (caminho === "/v1/condominio/documentos" && metodo === "POST") {
      if (!pode("documentos.editar")) return erro(route, 403, "FORBIDDEN");
      if (String(corpo.titulo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
      const d: DocumentoFalso = { id: novoId(), tipo: String(corpo.tipo), titulo: String(corpo.titulo).trim(), descricao: (corpo.descricao as string) ?? null,
        restrito: corpo.restrito === true, aoMorador: corpo.aoMorador === true, valeAte: (corpo.valeAte as string) ?? null, arquivado: null, criadoEm: agora,
        versao: 1, versoes: [], historico: [{ acao: "documento.criado", em: agora, autor: ctx.eu.nome, dados: {} }] };
      est.documentos.push(d);
      return route.fulfill({ status: 201, json: { id: d.id, versao: 1 } });
    }
    const r = /^\/v1\/condominio\/documentos\/([^/]+)(\/arquivar|\/email|\/envios\/([^/]+)\/cancelar|\/versoes(?:\/([^/]+)\/(verificar|link))?)?$/.exec(caminho);
    const d = r ? visiveis.find((x) => x.id === r[1]) : undefined;
    if (!r || !d) return erro(route, 404, "NOT_FOUND");
    const dh = (acao: string, dados: Record<string, unknown>) => d.historico.unshift({ acao, em: agora, autor: ctx.eu.nome, dados });
    if (!r[2] && metodo === "GET") {
      return route.fulfill({ json: { documento: { ...docJson(d), criadoEm: d.criadoEm, criadoPor: "Ana Souza",
        arquivamento: d.arquivado ?? undefined }, versoes: [...d.versoes].reverse().map((v) => ({ ...v, emVigor: v.id === vigor(d)?.id })),
        historico: d.historico, pode: { editar: pode("documentos.editar") && !d.arquivado, enviar: pode("documentos.editar") && !d.arquivado,
          restritos: pode("documentos.restritos"),
          enviarEmail: pode("documentos.editar") && d.aoMorador && !d.restrito && !d.arquivado && !!vigor(d) && est.mural.emailLigado },
        limites: { tamanho: 20971520 }, hoje: h,
        envios: est.enviosDoc.filter((e) => e.documentoId === d.id).map((e) => ({ ...e, estado: "ENVIADO", numero: vigor(d)?.numero })),
        contatosComEmail: m.contatos.filter((x) => comEmail(x.id)).map((x) => ({ id: x.id, nome: x.nome, unidades: m.vinculos.filter((v) => v.contatoId === x.id)
          .map((v) => nomeUnidade(v.unidadeId)).join(", ") })) } });
    }
    if (!pode("documentos.editar")) return erro(route, 403, "FORBIDDEN");
    if (!r[2] && metodo === "PUT") {
      Object.assign(d, { tipo: corpo.tipo, titulo: corpo.titulo, descricao: corpo.descricao ?? null, restrito: corpo.restrito === true,
        aoMorador: corpo.aoMorador === true, valeAte: corpo.valeAte ?? null, versao: d.versao + 1 });
      dh("documento.alterado", {});
      return route.fulfill({ json: { id: d.id, versao: d.versao } });
    }
    if (r[2] === "/email") {
      const contatos = (corpo.contatos as string[]) ?? [];
      const emails = (corpo.emails as string[]) ?? [];
      if (!contatos.length && !emails.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ["contatos"] });
      for (const id of contatos) est.enviosDoc.unshift({ id: novoId(), documentoId: d.id, para: "contato", contato: m.contatos.find((x) => x.id === id)?.nome ?? undefined,
        criadoEm: agora, cancelado: false, pedido: false });
      for (const e of emails) est.enviosDoc.unshift({ id: novoId(), documentoId: d.id, para: e, criadoEm: agora, cancelado: false, pedido: false });
      dh("documento.enviado_por_email", { quantos: contatos.length + emails.length });
      return route.fulfill({ status: 201, json: { enviados: contatos.length + emails.length } });
    }
    if (r[2]?.startsWith("/envios/")) {
      const e = est.enviosDoc.find((x) => x.id === r[3]);
      if (!e) return erro(route, 404, "NOT_FOUND");
      e.cancelado = true;
      dh("documento.link_cancelado", {});
      return route.fulfill({ json: { ok: true } });
    }
    if (r[2] === "/arquivar") {
      if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      d.arquivado = { motivo: String(corpo.motivo).trim(), em: agora, por: ctx.eu.nome }; d.versao++;
      dh("documento.arquivado", { motivo: d.arquivado.motivo });
      return route.fulfill({ json: { versao: d.versao } });
    }
    if (r[2] === "/versoes" && metodo === "POST") {
      if (!corpo.vigenteDesde) return erro(route, 400, "VALIDATION_ERROR", { campos: ["vigenteDesde"] });
      if (d.versoes.some((v) => v.situacao === "LIBERADO") && String(corpo.mudanca ?? "").trim().length < 3) {
        return erro(route, 400, "VALIDATION_ERROR", { campos: ["mudanca"] });
      }
      const v: VersaoFalsa = { id: novoId(), mudanca: (corpo.mudanca as string) ?? undefined, vigenteDesde: String(corpo.vigenteDesde),
        aprovadoEm: (corpo.aprovadoEm as string) ?? undefined, nome: String(corpo.nome), tipo: String(corpo.tipo), tamanho: Number(corpo.tamanho),
        situacao: "ENVIANDO", enviadoEm: agora, enviadoPor: ctx.eu.nome };
      d.versoes.push(v);
      return route.fulfill({ status: 201, json: { versaoId: v.id, envio: { url: `/api/v1/armazenamento/${v.id}`, metodo: "PUT", tipo: v.tipo } } });
    }
    const v = d.versoes.find((x) => x.id === r[4]);
    if (!v) return erro(route, 404, "NOT_FOUND");
    if (r[5] === "verificar") {
      const motivo = conferir(conteudoEnviado(v.id), v.tipo);
      if (motivo) { v.situacao = "NAO_LIBERADO"; v.motivoRecusa = motivo; return route.fulfill({ json: { situacao: v.situacao, motivo } }); }
      v.situacao = "LIBERADO"; v.numero = Math.max(0, ...d.versoes.map((x) => x.numero ?? 0)) + 1;
      dh("documento.versao_guardada", { numero: v.numero, vigenteDesde: v.vigenteDesde });
      return route.fulfill({ json: { situacao: "LIBERADO", numero: v.numero } });
    }
    dh(url.searchParams.get("baixar") === "1" ? "documento.baixado" : "documento.aberto", { numero: v.numero });
    return route.fulfill({ json: { url: `/api/v1/armazenamento/${v.id}`, tipo: v.tipo, expiraEm: agora } });
  }

  // Comunicados.
  if (!pode("comunicados.ver")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/comunicados/opcoes") {
    return route.fulfill({ json: {
      assuntos: est.plano.assuntos, plano: est.plano.plano ?? undefined, assinatura: est.plano.assinatura ?? undefined,
      silencio: { inicio: est.plano.silencioInicio, fim: est.plano.silencioFim }, fuso: "America/Sao_Paulo",
      blocos: m.blocos.filter((b) => b.ativo).map((b) => ({ id: b.id, nome: b.nome })),
      unidades: m.unidades.filter((u) => u.ativa).map((u) => ({ id: u.id, nome: nomeUnidade(u.id), blocoId: u.blocoId ?? undefined })),
      ...(pode("moradores.ver") ? { contatos: m.contatos.map((x) => ({ id: x.id, nome: x.nome, unidades: m.vinculos.filter((v) => v.contatoId === x.id).map((v) => nomeUnidade(v.unidadeId)) })) } : {}),
      ...(pode("pedidos.ver") ? { pedidos: ctx.pedidos.filter((p) => p.estado !== "ENCERRADO" && p.estado !== "CANCELADO").map((p) => ({ id: p.id, protocolo: p.protocolo, assunto: p.assunto })) } : {}),
      pode: { publicar: pode("comunicados.publicar"), verMoradores: pode("moradores.ver") }, agora,
      canais: { muralLigado: est.mural.ligado, muralAssuntos: est.mural.assuntos, emailLigado: est.mural.emailLigado,
        whatsappLigado: zap.ligado, whatsappConectado: zap.conectado },
    } });
  }
  if (caminho === "/v1/condominio/comunicados/publico") {
    return route.fulfill({ json: calcular(String(corpo.assunto), String(corpo.publico), (corpo.blocos as string[]) ?? [], (corpo.unidades as string[]) ?? [],
      (corpo.contatos as string[]) ?? []) });
  }
  if (caminho === "/v1/condominio/comunicados" && metodo === "GET") {
    const f = url.searchParams.get("filtro") ?? "EM_USO";
    const at = url.searchParams.get("atencao");
    const parado = (c: ComunicadoFalso) => c.estado === "RASCUNHO" && Date.parse(c.atualizadoEm) < Date.now() - 3 * 86400_000;
    // O período (D4.9, decisão C.1): o dia que a aba mostra, em Brasília; o fim antes do começo volta com o campo.
    const de = url.searchParams.get("de"), ate = url.searchParams.get("ate");
    if (de && ate && de > ate) return erro(route, 400, "VALIDATION_ERROR", { campos: ["ate"] });
    const diaNaAba = (c: ComunicadoFalso) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(
      (c.estado === "PUBLICADO" ? c.publicadoEm : c.estado === "PROGRAMADO" ? c.programadoPara : c.estado === "ARQUIVADO" ? c.arquivamento?.em : null) ?? c.atualizadoEm));
    const itens = est.comunicados.filter((c) => (f === "EM_USO" ? ["RASCUNHO", "PROGRAMADO", "PUBLICADO"].includes(c.estado) : c.estado === f)
      && (at !== "RASCUNHOS_PARADOS" || parado(c)) && (at !== "PROGRAMADOS_HOJE" || c.estado === "PROGRAMADO")
      && (!de || diaNaAba(c) >= de) && (!ate || diaNaAba(c) <= ate));
    return route.fulfill({ json: { itens: itens.map(json), total: itens.length, pagina: 1,
      atalhos: { rascunhosParados: est.comunicados.filter(parado).length, programadosHoje: est.comunicados.filter((c) => c.estado === "PROGRAMADO").length },
      pode: { publicar: pode("comunicados.publicar") } } });
  }
  const salvar = (c: ComunicadoFalso | null) => {
    if (!pode("comunicados.publicar")) return erro(route, 403, "FORBIDDEN");
    const campos: string[] = [];
    if (String(corpo.titulo ?? "").trim().length < 3) campos.push("titulo");
    if (String(corpo.texto ?? "").trim().length < 3) campos.push("texto");
    if (corpo.publico === "BLOCOS" && !(corpo.blocos as string[]).length) campos.push("blocos");
    if (corpo.acao === "PROGRAMAR" && (!corpo.programadoPara || Date.parse(String(corpo.programadoPara)) < Date.now())) campos.push("programadoPara");
    // O evento (CD-17): só o dia é obrigatório; o fim pede o início e vem depois dele.
    const ev = corpo.evento as Partial<EventoFalso> | null | undefined;
    if (ev && (!/^\d{4}-\d{2}-\d{2}$/.test(String(ev.dia ?? "")) || (ev.fim && (!ev.inicio || ev.fim <= ev.inicio)) || (ev.local && ev.local.trim().length < 2))) campos.push("evento");
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const dados = { assunto: String(corpo.assunto), titulo: String(corpo.titulo).trim(), texto: String(corpo.texto).trim(), publico: String(corpo.publico),
      blocos: (corpo.blocos as string[]) ?? [], unidades: (corpo.unidades as string[]) ?? [], contatos: (corpo.contatos as string[]) ?? [],
      pedidoId: (corpo.pedidoId as string) ?? null, manutencaoId: (corpo.manutencaoId as string) ?? null, atualizadoEm: agora,
      noMural: corpo.publico === "TODOS" && (typeof corpo.noMural === "boolean" ? corpo.noMural : est.mural.assuntos.includes(String(corpo.assunto))),
      porEmail: corpo.porEmail !== false, ...(typeof corpo.porWhatsapp === "boolean" ? { porWhatsapp: corpo.porWhatsapp } : {}),
      evento: ev ? { dia: String(ev.dia), ...(ev.inicio ? { inicio: ev.inicio } : {}), ...(ev.fim ? { fim: ev.fim } : {}), ...(ev.local?.trim() ? { local: ev.local.trim() } : {}) } : null };
    if (!c) {
      const id = novoId();
      c = { id, familiaId: id, numero: 1, ...dados, estado: "RASCUNHO", programadoPara: null, publicadoEm: null, publicadoPor: null, destinatarios: null,
        assinatura: null, mudanca: null, substituidoEm: null, arquivamento: null, autor: ctx.eu.nome, criadoEm: agora, versao: 1 };
      est.comunicados.push(c);
      hist(id, "comunicado.escrito");
    } else {
      if (!["RASCUNHO", "PROGRAMADO"].includes(c.estado)) return erro(route, 422, "VALIDATION_ERROR", { motivo: "COMUNICADO_PUBLICADO" });
      if (corpo.versao !== c.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: c.versao });
      Object.assign(c, dados, { versao: c.versao + 1 });
      hist(c.familiaId, "comunicado.alterado", { campos: [] });
    }
    c.estado = corpo.acao === "PROGRAMAR" ? "PROGRAMADO" : "RASCUNHO";
    c.programadoPara = corpo.acao === "PROGRAMAR" ? String(corpo.programadoPara) : null;
    if (corpo.acao === "PROGRAMAR") hist(c.familiaId, "comunicado.programado");
    if (corpo.acao === "PUBLICAR") publicar(c);
    return route.fulfill({ status: metodo === "POST" ? 201 : 200, json: { id: c.id, versao: c.versao } });
  };
  if (caminho === "/v1/condominio/comunicados" && metodo === "POST") return salvar(null);

  const r = /^\/v1\/condominio\/comunicados\/([^/]+)(?:\/(corrigir|arquivar|uso|arquivos|mural)(?:\/([^/]+)\/(verificar|link|tirar))?)?$/.exec(caminho);
  const c = r ? est.comunicados.find((x) => x.id === r[1]) : undefined;
  if (!r || !c) return erro(route, 404, "NOT_FOUND");
  if (!r[2] && metodo === "PUT") return salvar(c);
  if (!r[2]) {
    const familia = est.comunicados.filter((x) => x.familiaId === c.familiaId);
    return route.fulfill({ json: {
      comunicado: { ...json(c), texto: c.texto, assinatura: c.assinatura ?? est.plano.assinatura ?? undefined, mudanca: c.mudanca ?? undefined,
        blocos: c.blocos, unidades: c.unidades, contatos: c.contatos, pedidoId: c.pedidoId ?? undefined, manutencaoId: c.manutencaoId ?? undefined,
        arquivamento: c.arquivamento ?? undefined },
      publicoAgora: calcular(c.assunto, c.publico, c.blocos, c.unidades, c.contatos),
      versoes: familia.sort((a, b) => b.numero - a.numero).map((x) => ({ id: x.id, numero: x.numero, estado: x.estado, titulo: x.titulo, texto: x.texto,
        mudanca: x.mudanca ?? undefined, publicadoEm: x.publicadoEm ?? undefined, publicadoPor: x.publicadoPor ?? undefined, substituidoEm: x.substituidoEm ?? undefined })),
      arquivos: est.arquivos.filter((a) => a.familiaId === c.familiaId).map((a) => ({ ...a, enviadoPor: ctx.eu.nome, podeTirar: pode("comunicados.publicar") })),
      historico: est.historico.get(c.familiaId) ?? [],
      pode: { editar: pode("comunicados.publicar") && ["RASCUNHO", "PROGRAMADO"].includes(c.estado), corrigir: pode("comunicados.publicar") && c.estado === "PUBLICADO",
        arquivar: pode("comunicados.publicar") && ["RASCUNHO", "PROGRAMADO", "PUBLICADO"].includes(c.estado),
        enviar: pode("comunicados.publicar") && ["RASCUNHO", "PROGRAMADO"].includes(c.estado), copiar: c.estado === "PUBLICADO",
        mural: pode("comunicados.publicar") && c.publico === "TODOS" && ["RASCUNHO", "PROGRAMADO", "PUBLICADO"].includes(c.estado),
        avisarEmail: est.mural.emailLigado && c.porEmail !== false && c.estado === "PUBLICADO",
        avisarWhatsapp: zap.ligado && c.porWhatsapp !== false && c.estado === "PUBLICADO" && est.comunicados.some((x) => x.familiaId === c.familiaId && !!x.whatsapps) },
      condominio: "Residencial Ipê", limites: { arquivos: 4, tamanho: 10485760 },
      canais: { noMural: !!c.noMural, porEmail: c.porEmail !== false, muralLigado: est.mural.ligado, emailLigado: est.mural.emailLigado,
        porWhatsapp: c.porWhatsapp !== false, whatsappLigado: zap.ligado, whatsappConectado: zap.conectado },
      email: { total: c.emails ?? 0, naFila: 0, enviados: c.emails ?? 0, entregues: c.emails ?? 0, devolvidos: 0, spam: 0, falharam: 0, cancelados: 0, abertos: 0 },
      ...(zap.ligado ? { whatsapp: (() => {
        const total = c.whatsapps ?? 0;
        const falharam = c.whatsappFalhas?.length ?? 0;
        return { total, naFila: 0, enviadas: total - falharam, entregues: total - falharam, lidas: total - falharam > 0 ? 1 : 0, falharam, canceladas: 0,
          abertos: total - falharam > 0 ? 1 : 0 };
      })() } : {}),
      problemas: zap.ligado && pode("moradores.ver") ? (c.whatsappFalhas ?? []).map((f, i) => ({ envioId: `w-${i}`, contatoId: f.contatoId,
        nome: m.contatos.find((x) => x.id === f.contatoId)?.nome ?? "", unidades: m.vinculos.filter((v) => v.contatoId === f.contatoId).map((v) => nomeUnidade(v.unidadeId)).join(", "),
        canal: "WHATSAPP", estado: "FALHOU", motivo: f.motivo })) : [],
    } });
  }
  if (r[2] === "mural") {
    if (!pode("comunicados.publicar")) return erro(route, 403, "FORBIDDEN");
    c.noMural = corpo.noMural === true; c.versao++;
    hist(c.familiaId, c.noMural ? "comunicado.mural_ligado" : "comunicado.mural_tirado");
    return route.fulfill({ json: { versao: c.versao } });
  }
  if (r[2] === "uso") {
    if (c.estado !== "PUBLICADO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "COMUNICADO_NAO_PUBLICADO" });
    hist(c.familiaId, corpo.uso === "COPIADO" ? "comunicado.copiado" : "comunicado.mural", { numero: c.numero });
    return route.fulfill({ json: { ok: true } });
  }
  if (!pode("comunicados.publicar")) return erro(route, 403, "FORBIDDEN");
  if (r[2] === "corrigir") {
    if (String(corpo.mudanca ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["mudanca"] });
    c.estado = "SUBSTITUIDO"; c.substituidoEm = agora; c.versao++;
    const nova: ComunicadoFalso = { ...c, id: novoId(), numero: c.numero + 1, titulo: String(corpo.titulo).trim(), texto: String(corpo.texto).trim(),
      estado: "PUBLICADO", mudanca: String(corpo.mudanca).trim(), substituidoEm: null, publicadoEm: agora, publicadoPor: ctx.eu.nome, versao: 1, criadoEm: agora, atualizadoEm: agora };
    nova.emails = 0;
    nova.whatsapps = 0;
    nova.whatsappFalhas = [];
    est.comunicados.push(nova);
    hist(c.familiaId, "comunicado.corrigido", { numero: nova.numero, mudanca: nova.mudanca });
    if (corpo.avisarEmail === true) {
      nova.emails = new Set(destinatarios(nova.assunto, nova.publico, nova.blocos, nova.unidades, nova.contatos).filter((v) => comEmail(v.contatoId)).map((v) => v.contatoId)).size;
      hist(c.familiaId, "comunicado.email_na_fila", { numero: nova.numero, quantos: nova.emails });
    }
    if (corpo.avisarWhatsapp === true && zap.ligado) {
      nova.whatsapps = (c.whatsapps ?? 0) - (c.whatsappFalhas?.length ?? 0);
      hist(c.familiaId, "comunicado.whatsapp_na_fila", { numero: nova.numero, quantos: nova.whatsapps, corrigido: true });
    }
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }
  if (r[2] === "arquivar") {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    c.estado = "ARQUIVADO"; c.arquivamento = { motivo: String(corpo.motivo).trim(), em: agora, por: ctx.eu.nome }; c.versao++;
    hist(c.familiaId, "estado.mudou", { para: "ARQUIVADO", motivo: c.arquivamento.motivo });
    return route.fulfill({ json: { versao: c.versao } });
  }
  if (r[2] === "arquivos" && !r[3]) {
    const a: ArquivoFalso = { id: novoId(), familiaId: c.familiaId, nome: String(corpo.nome), tipo: String(corpo.tipo), tamanho: Number(corpo.tamanho),
      situacao: "ENVIANDO", enviadoEm: agora };
    est.arquivos.push(a);
    return route.fulfill({ status: 201, json: { arquivoId: a.id, envio: { url: `/api/v1/armazenamento/${a.id}`, metodo: "PUT", tipo: a.tipo } } });
  }
  const a = est.arquivos.find((x) => x.id === r[3]);
  if (!a) return erro(route, 404, "NOT_FOUND");
  if (r[4] === "verificar") {
    const motivo = conferir(conteudoEnviado(a.id), a.tipo);
    a.situacao = motivo ? "NAO_LIBERADO" : "LIBERADO";
    if (motivo) a.motivoRecusa = motivo;
    hist(c.familiaId, motivo ? "comunicado.arquivo_recusado" : "comunicado.arquivo_enviado", { arquivoNome: a.nome });
    return route.fulfill({ json: { situacao: a.situacao, ...(motivo ? { motivo } : {}) } });
  }
  if (r[4] === "link") return route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, tipo: a.tipo, expiraEm: agora } });
  est.arquivos = est.arquivos.filter((x) => x.id !== a.id);
  hist(c.familiaId, "comunicado.arquivo_tirado", { arquivoNome: a.nome });
  return route.fulfill({ json: { ok: true } });
}

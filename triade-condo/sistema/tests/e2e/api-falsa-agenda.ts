// Parte da agenda da API falsa da Plataforma (peça R7). As regras de verdade estão testadas no
// banco (pgTAP 014) e na API (Deno); aqui só o bastante para a tela: conflito por pessoa ou
// lugar, repetição simples, reagendar e cancelar com motivo, e a agenda do pedido.
import type { Route } from "@playwright/test";

let n = 0;
const novoId = () => `8f9a0b1c-2d3e-4f4a-9b5c-${String(++n).padStart(12, "0")}`;

/** Hoje em Brasília: a tela usa o relógio do aparelho até a API responder. */
export function hojeFalso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
export function somar(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

interface Pessoa { vinculoId: string; nome: string; funcao: string }
interface PedidoFalso { id: string; protocolo: string; assunto: string; estado: string; unidadeId: string | null; responsavelId: string | null; previsao: string | null }
interface Moradores { unidades: { id: string; blocoId: string | null; identificacao: string; ativa: boolean }[]; blocos: { id: string; nome: string }[] }

export interface CompromissoFalso {
  id: string; serieId: string | null; tipo: string; titulo: string; data: string; horaInicio: string | null; horaFim: string | null;
  onde: string; unidadeId: string | null; local: string | null; participantes: string[]; deFora: string | null; pedidoId: string | null;
  observacao: string | null; estado: string; versao: number; criadoEm: string; cancelamento: { em: string; motivo: string; por: string } | null;
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
interface Serie { id: string; frequencia: string; intervalo: number }

export interface EstadoAgenda { compromissos: CompromissoFalso[]; series: Serie[] }

/** Hoje: a visita do encanador (ligada ao pedido 2026-0001) e a reunião do conselho; na terça, a limpeza da caixa-d'água, que se repete. */
export function criarAgenda(vAna: string, vBruna: string, pedido: PedidoFalso): EstadoAgenda {
  const h = hojeFalso();
  const base = (m: Partial<CompromissoFalso>): CompromissoFalso => ({
    id: novoId(), serieId: null, tipo: "REUNIAO", titulo: "", data: h, horaInicio: null, horaFim: null, onde: "NENHUM", unidadeId: null, local: null,
    participantes: [], deFora: null, pedidoId: null, observacao: null, estado: "PLANEJADO", versao: 1, criadoEm: `${somar(h, -7)}T19:02:00Z`, cancelamento: null,
    historico: [], ...m,
  });
  const serie = { id: novoId(), frequencia: "MENSAL", intervalo: 6 };
  const lista = [
    base({ tipo: "VISITA", titulo: "Encanador no apto 101", horaInicio: "14:00", horaFim: "15:00", onde: "UNIDADE", unidadeId: pedido.unidadeId,
      participantes: [vBruna], deFora: "Hidro Serviços", pedidoId: pedido.id, estado: "CONFIRMADO" }),
    base({ tipo: "REUNIAO", titulo: "Reunião do conselho", horaInicio: "19:00", horaFim: "21:00", onde: "AREA_COMUM", local: "Salão de festas",
      participantes: [vAna], estado: "A_CONFIRMAR" }),
    base({ tipo: "ATIVIDADE", titulo: "Limpeza da caixa-d'água", data: somar(h, 3), horaInicio: "08:00", horaFim: "09:00", onde: "AREA_COMUM",
      local: "Cobertura", deFora: "Hidro Serviços", serieId: serie.id }),
    base({ tipo: "ATIVIDADE", titulo: "Limpeza da caixa-d'água", data: somar(h, 185), horaInicio: "08:00", horaFim: "09:00", onde: "AREA_COMUM",
      local: "Cobertura", deFora: "Hidro Serviços", serieId: serie.id }),
  ];
  for (const c of lista) {
    c.historico = [{ acao: "estado.mudou", em: c.criadoEm, autor: "Ana Souza", dados: { para: c.estado } },
      { acao: "compromisso.marcado", em: c.criadoEm, autor: "Ana Souza", dados: { tipo: c.tipo, ...(c.serieId ? { repeticao: "MENSAL" } : {}) } }];
  }
  return { compromissos: lista, series: [serie] };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const sobrepoe = (a: CompromissoFalso, i: string | null, f: string | null) =>
  !a.horaInicio || !i || (a.horaInicio < (f ?? i) && i < (a.horaFim ?? a.horaInicio)) || (!a.horaFim && !f && a.horaInicio === i);

/** Datas de outras telas (AG-09), cada uma só para quem vê a tela de origem, como o banco manda. */
function datasDeFora(hoje: string, pode: (a: string) => boolean) {
  return [
    ...(pode("manutencao.ver") ? [{ data: somar(hoje, 2), titulo: "Elevadores Atlas", fonte: "CONTRATO", id: "6b1c2d3e-4f5a-4b6c-8d7e-000000000001" }] : []),
    ...(pode("documentos.ver") ? [{ data: somar(hoje, 3), titulo: "AVCB", fonte: "DOCUMENTO", id: "6b1c2d3e-4f5a-4b6c-8d7e-000000000002", restrito: false }] : []),
    ...(pode("documentos.restritos")
      ? [{ data: somar(hoje, 3), titulo: "Apólice do seguro", fonte: "DOCUMENTO", id: "6b1c2d3e-4f5a-4b6c-8d7e-000000000003", restrito: true }] : []),
    ...(pode("assembleias.ver") ? [{ data: somar(hoje, 4), titulo: "Assembleia geral ordinária", fonte: "ASSEMBLEIA", id: "6b1c2d3e-4f5a-4b6c-8d7e-000000000004",
      horaInicio: "19:00", segundaChamada: "19:30", local: "Salão de festas", estado: "CONVOCADA" }] : []),
  ];
}

export async function rotasAgenda(route: Route, ag: EstadoAgenda, ctx: {
  pessoas: Pessoa[]; pedidos: PedidoFalso[]; moradores: Moradores; feriados: { data: string; descricao: string }[]; eu: { vinculo: string; nome: string };
  datasDeFora?: boolean;
}, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean) {
  const pa = /^\/v1\/condominio\/pedidos\/([^/]+)\/agenda$/.exec(caminho);
  if (!caminho.startsWith("/v1/condominio/agenda") && !pa) return null;
  const hoje = hojeFalso();
  const nomeVinculo = (v: string) => ctx.pessoas.find((p) => p.vinculoId === v)?.nome ?? "";
  const nomeUnidade = (id: string | null) => {
    const u = ctx.moradores.unidades.find((x) => x.id === id);
    return u ? [ctx.moradores.blocos.find((b) => b.id === u.blocoId)?.nome, u.identificacao].filter(Boolean).join(" · ") : undefined;
  };
  const json = (c: CompromissoFalso) => {
    const s = c.serieId ? ag.series.find((x) => x.id === c.serieId) : null;
    const daSerie = s ? ag.compromissos.filter((x) => x.serieId === s.id) : [];
    const p = ctx.pedidos.find((x) => x.id === c.pedidoId);
    return {
      id: c.id, tipo: c.tipo, titulo: c.titulo, data: c.data, horaInicio: c.horaInicio ?? undefined, horaFim: c.horaFim ?? undefined, diaTodo: !c.horaInicio,
      onde: c.onde, unidadeId: c.unidadeId ?? undefined, local: c.local ?? undefined, lugar: c.onde === "UNIDADE" ? nomeUnidade(c.unidadeId) : c.local ?? undefined,
      participantes: c.participantes.map((v) => ({ vinculoId: v, nome: nomeVinculo(v) })), deFora: c.deFora ?? undefined, observacao: c.observacao ?? undefined,
      estado: c.estado, versao: c.versao, pedido: p && pode("pedidos.ver") ? { id: p.id, protocolo: p.protocolo, assunto: p.assunto } : undefined,
      serie: s ? { id: s.id, frequencia: s.frequencia, intervalo: s.intervalo, ate: daSerie.map((x) => x.data).sort().at(-1)!, total: daSerie.length } : undefined,
      cancelamento: c.cancelamento ?? undefined,
    };
  };
  const conflitos = (ignorar: string[], data: string, v: Pick<CompromissoFalso, "horaInicio" | "horaFim" | "onde" | "unidadeId" | "local" | "participantes">) =>
    ag.compromissos.filter((c) => c.data === data && !ignorar.includes(c.id) && !["REALIZADO", "CANCELADO"].includes(c.estado) && sobrepoe(c, v.horaInicio, v.horaFim))
      .flatMap((c) => {
        const lugar = (v.onde === "UNIDADE" && c.unidadeId === v.unidadeId) || (["AREA_COMUM", "OUTRO"].includes(v.onde) && c.local?.toLowerCase() === v.local?.toLowerCase());
        const comuns = c.participantes.filter((x) => v.participantes.includes(x));
        if (!lugar && comuns.length === 0) return [];
        return [{ id: c.id, titulo: c.titulo, data: c.data, horaInicio: c.horaInicio ?? undefined, horaFim: c.horaFim ?? undefined,
          motivo: lugar ? "LUGAR" : "PESSOA", ...(lugar ? {} : { pessoas: comuns.map(nomeVinculo) }) }];
      });
  const campos = () => ({
    tipo: String(corpo.tipo), titulo: String(corpo.titulo ?? "").trim(), horaInicio: (corpo.horaInicio as string) ?? null, horaFim: (corpo.horaFim as string) ?? null,
    onde: String(corpo.onde ?? "NENHUM"), unidadeId: (corpo.unidadeId as string) ?? null, local: (corpo.local as string)?.trim() || null,
    participantes: (corpo.participantes as string[]) ?? [], deFora: (corpo.deFora as string) ?? null, pedidoId: (corpo.pedidoId as string) ?? null,
    observacao: (corpo.observacao as string) ?? null,
  });
  const recusa = (v: ReturnType<typeof campos>) => {
    const ruins: string[] = [];
    if (v.titulo.length < 3) ruins.push("titulo");
    if (v.horaFim && (!v.horaInicio || v.horaFim <= v.horaInicio)) ruins.push("horaFim");
    if (v.onde === "UNIDADE" && !v.unidadeId) ruins.push("unidadeId");
    if (["AREA_COMUM", "OUTRO"].includes(v.onde) && (v.local ?? "").length < 2) ruins.push("local");
    return ruins;
  };
  const hist = (c: CompromissoFalso, acao: string, dados: Record<string, unknown>) =>
    c.historico.unshift({ acao, em: new Date().toISOString(), autor: ctx.eu.nome, dados });
  const versaoErrada = (c: CompromissoFalso) => corpo.versao !== c.versao ? erro(route, 409, "VERSION_CONFLICT", { versao: c.versao }) : null;
  const alcance = (c: CompromissoFalso) => corpo.escopo === "PROXIMAS" && c.serieId
    ? ag.compromissos.filter((x) => x.serieId === c.serieId && !["REALIZADO", "CANCELADO"].includes(x.estado) && (x.id === c.id || (x.data > c.data && x.data >= hoje)))
    : [c];

  if (pa) {
    const p = ctx.pedidos.find((x) => x.id === pa[1]);
    if (!p) return erro(route, 404, "NOT_FOUND");
    if (!pode("agenda.ver")) return route.fulfill({ json: { podeVer: false, podeMarcar: false, compromissos: [], divergencia: null } });
    const ligados = ag.compromissos.filter((c) => c.pedidoId === p.id && c.estado !== "CANCELADO").sort((a, b) => a.data.localeCompare(b.data));
    const div = p.previsao ? ligados.find((c) => c.tipo === "VISITA" && c.data > p.previsao! && c.estado !== "REALIZADO") : undefined;
    return route.fulfill({ json: { podeVer: true, podeMarcar: pode("agenda.editar"), compromissos: ligados.map(json),
      divergencia: div ? { previsao: p.previsao, compromissoId: div.id, titulo: div.titulo, data: div.data } : null } });
  }
  if (!pode("agenda.ver")) return erro(route, 403, "FORBIDDEN");

  if (caminho === "/v1/condominio/agenda/opcoes") {
    return route.fulfill({ json: {
      pessoas: ctx.pessoas.filter((p) => ["SINDICO", "AUTORIZADO"].includes(p.funcao)).map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, eu: p.vinculoId === ctx.eu.vinculo })),
      unidades: ctx.moradores.unidades.filter((u) => u.ativa).map((u) => ({ id: u.id, nome: nomeUnidade(u.id) })),
      pedidos: pode("pedidos.ver") ? ctx.pedidos.filter((p) => ["ABERTO", "EM_ANDAMENTO", "EM_REVISAO"].includes(p.estado))
        .map((p) => ({ id: p.id, protocolo: p.protocolo, assunto: p.assunto, unidadeId: p.unidadeId, responsavelId: p.responsavelId })) : [],
      pode: { editar: pode("agenda.editar") }, hoje,
    } });
  }
  if (caminho === "/v1/condominio/agenda" && metodo === "GET") {
    const de = url.searchParams.get("de") ?? "", ate = url.searchParams.get("ate") ?? "";
    if (!de || !ate || ate < de) return erro(route, 400, "VALIDATION_ERROR", { campos: ["ate"] });
    const lista = ag.compromissos.filter((c) => c.data >= de && c.data <= ate)
      .sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""));
    return route.fulfill({ json: {
      compromissos: lista.map(json), hoje, pode: { editar: pode("agenda.editar") },
      datas: [
        ...(pode("config.ver") ? ctx.feriados.filter((f) => f.data >= de && f.data <= ate).map((f) => ({ data: f.data, titulo: f.descricao, fonte: "FERIADO" })) : []),
        ...(ctx.datasDeFora ? datasDeFora(hoje, pode).filter((d) => d.data >= de && d.data <= ate) : []),
      ],
    } });
  }
  if (caminho === "/v1/condominio/agenda" && metodo === "POST") {
    if (!pode("agenda.editar")) return erro(route, 403, "FORBIDDEN");
    const v = campos();
    const ruins = recusa(v);
    if (ruins.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ruins });
    const primeira = String(corpo.data);
    const datas = [primeira];
    if (corpo.repetir) {
      const vezes = Number(corpo.vezes) || 0;
      const passo = corpo.repetir === "SEMANAL" ? 7 : corpo.repetir === "QUINZENAL" ? 14 : 0;
      if (!passo || vezes < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["vezes"] });
      for (let k = 1; k < vezes; k++) datas.push(somar(primeira, passo * k));
    }
    const achados = datas.flatMap((d) => conflitos([], d, v));
    if (achados.length && corpo.aceitarConflito !== true) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONFLITO_HORARIO", conflitos: achados });
    const serie = datas.length > 1 ? { id: novoId(), frequencia: String(corpo.repetir), intervalo: 1 } : null;
    if (serie) ag.series.push(serie);
    const novos = datas.map((d) => ({ ...v, id: novoId(), serieId: serie?.id ?? null, data: d, estado: String(corpo.estado ?? "PLANEJADO"), versao: 1,
      criadoEm: new Date().toISOString(), cancelamento: null, historico: [] as CompromissoFalso["historico"] }));
    for (const c of novos) { hist(c, "estado.mudou", { para: c.estado }); hist(c, "compromisso.marcado", { tipo: c.tipo }); }
    ag.compromissos.push(...novos);
    return route.fulfill({ status: 201, json: { id: novos[0]!.id, datas: novos.length, conflitos: achados } });
  }

  const m = /^\/v1\/condominio\/agenda\/([^/]+)(\/[a-z]+)?$/.exec(caminho);
  const c = m ? ag.compromissos.find((x) => x.id === m[1]) : undefined;
  if (!m || !c) return erro(route, 404, "NOT_FOUND");
  const acao = m[2];
  if (!acao && metodo === "GET") {
    const fechado = ["REALIZADO", "CANCELADO"].includes(c.estado);
    return route.fulfill({ json: {
      compromisso: { ...json(c), registradoPor: "Ana Souza", registradoEm: c.criadoEm },
      conflitos: fechado ? [] : conflitos([c.id], c.data, c), historico: c.historico, hoje, pode: { editar: pode("agenda.editar") && !fechado },
    } });
  }
  if (!pode("agenda.editar")) return erro(route, 403, "FORBIDDEN");
  const conflito = versaoErrada(c); if (conflito) return conflito;
  if (["REALIZADO", "CANCELADO"].includes(c.estado)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "COMPROMISSO_ENCERRADO" });

  if (!acao && metodo === "PUT") {
    const v = campos();
    const ruins = recusa(v);
    if (ruins.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ruins });
    const alvos = alcance(c);
    const achados = alvos.flatMap((x) => conflitos(alvos.map((y) => y.id), x.data, v));
    if (achados.length && corpo.aceitarConflito !== true) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONFLITO_HORARIO", conflitos: achados });
    for (const x of alvos) { Object.assign(x, v); x.versao++; hist(x, "compromisso.alterado", { escopo: corpo.escopo }); }
    return route.fulfill({ json: { versao: c.versao, alterados: alvos.length, conflitos: achados } });
  }
  if (acao === "/reagendar") {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    const para = String(corpo.data);
    const v = { ...c, horaInicio: (corpo.horaInicio as string) ?? null, horaFim: (corpo.horaFim as string) ?? null };
    const achados = conflitos([c.id], para, v);
    if (achados.length && corpo.aceitarConflito !== true) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONFLITO_HORARIO", conflitos: achados });
    const delta = Math.round((Date.parse(para) - Date.parse(c.data)) / 86400000);
    const alvos = alcance(c);
    for (const x of alvos) {
      const de = x.data;
      x.data = somar(x.data, delta); x.horaInicio = v.horaInicio; x.horaFim = v.horaFim; x.versao++;
      hist(x, "compromisso.reagendado", { de, para: x.data, motivo: String(corpo.motivo).trim(), escopo: corpo.escopo });
    }
    return route.fulfill({ json: { versao: c.versao, alterados: alvos.length, conflitos: achados } });
  }
  if (acao === "/situacao") {
    const para = String(corpo.estado);
    if (para === "REALIZADO" && c.data > hoje) return erro(route, 400, "VALIDATION_ERROR", { motivo: "AINDA_NAO_ACONTECEU" });
    hist(c, "estado.mudou", { de: c.estado, para });
    c.estado = para; c.versao++;
    return route.fulfill({ json: { versao: c.versao } });
  }
  if (acao === "/cancelar") {
    const motivo = String(corpo.motivo ?? "").trim();
    if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    const alvos = alcance(c);
    for (const x of alvos) {
      hist(x, "estado.mudou", { de: x.estado, para: "CANCELADO", motivo });
      x.estado = "CANCELADO"; x.versao++; x.cancelamento = { em: new Date().toISOString(), motivo, por: ctx.eu.nome };
    }
    return route.fulfill({ json: { cancelados: alvos.length } });
  }
  return erro(route, 404, "NOT_FOUND");
}

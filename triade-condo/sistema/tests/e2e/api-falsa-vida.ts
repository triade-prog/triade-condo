// Parte da Vida em condomínio da API falsa da Plataforma (peça R12; AC-01, AC-06, AC-07). As
// regras de verdade estão testadas no banco (pgTAP 023) e na API (Deno); aqui só o bastante para
// a tela: áreas comuns, a lista de reservas, a semana da área, aprovar, recusar e registrar.
import type { Route } from "@playwright/test";

interface AreaFalsa {
  id: string; modelo?: string; criadaPeloSindico: boolean; nome: string; ativa: boolean; reserva: "SINDICO" | "AUTOMATICA" | "SEM_RESERVA";
  antecedenciaMin: number; antecedenciaMax: number; horaInicio: string; horaFim: string; modo: "PERIODO" | "BLOCOS"; blocoMinutos?: number;
  capacidade?: number; limiteQuantidade?: number; limitePeriodo?: "SEMANA" | "MES"; toleranciaDias?: number; cancelarSemAvisoDias: number;
  valorCentavos?: number; podeProprietarioMorador: boolean; podeInquilino: boolean; podeProprietarioAusente: boolean; versao: number;
}
interface ReservaFalsa {
  id: string; protocolo: string; areaId: string; unidade: { id: string; nome: string }; contato?: { id: string; nome: string }; data: string;
  horaInicio: string; horaFim: string; estado: "A_APROVAR" | "CONFIRMADA" | "RECUSADA" | "CANCELADA"; origem: "WHATSAPP" | "PAINEL";
  tolerancia: boolean; observacao?: string; criadoEm: string; decisao?: { em: string; por?: string; motivo?: string }; versao: number;
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
export interface EstadoVida {
  areas: AreaFalsa[];
  reservas: ReservaFalsa[];
  unidades: { id: string; nome: string; contatos: { id: string; nome: string }[] }[];
  numero: number;
}

let n = 0;
const novoId = () => `7e8f9a0b-1c2d-4e3f-8a4b-${String(++n).padStart(12, "0")}`;
const dia = (d: number) => new Date(Date.now() - 3 * 3600_000 + d * 86400_000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarVida(): EstadoVida {
  const area = (nome: string, x: Partial<AreaFalsa>): AreaFalsa => ({
    id: novoId(), criadaPeloSindico: false, nome, ativa: false, reserva: "SINDICO", antecedenciaMin: 1, antecedenciaMax: 30, horaInicio: "10:00",
    horaFim: "22:00", modo: "PERIODO", cancelarSemAvisoDias: 3, podeProprietarioMorador: true, podeInquilino: true, podeProprietarioAusente: false, versao: 1, ...x,
  });
  const salao = area("Salão de festas", { modelo: "SALAO", ativa: true, antecedenciaMin: 2, antecedenciaMax: 60, horaFim: "23:00", capacidade: 80,
    limiteQuantidade: 1, limitePeriodo: "MES", valorCentavos: 15000 });
  const churras = area("Churrasqueira", { modelo: "CHURRASQUEIRA", ativa: true, reserva: "AUTOMATICA", horaInicio: "11:00", capacidade: 30,
    limiteQuantidade: 2, limitePeriodo: "MES", toleranciaDias: 7 });
  const unidades = [
    { id: novoId(), nome: "Torre A · 302", contatos: [{ id: novoId(), nome: "Marta Lima" }] },
    { id: novoId(), nome: "Torre B · 104", contatos: [{ id: novoId(), nome: "Rafael Dias" }] },
    { id: novoId(), nome: "Torre A · 101", contatos: [{ id: novoId(), nome: "Bruna Souza" }] },
  ];
  const r = (num: number, a: AreaFalsa, u: (typeof unidades)[number], data: string, x: Partial<ReservaFalsa>): ReservaFalsa => ({
    id: novoId(), protocolo: `2026-R${String(num).padStart(3, "0")}`, areaId: a.id, unidade: { id: u.id, nome: u.nome }, contato: u.contatos[0], data,
    horaInicio: a.horaInicio, horaFim: a.horaFim, estado: "A_APROVAR", origem: "WHATSAPP", tolerancia: false, criadoEm: agora(), versao: 1,
    historico: [{ acao: "reserva.registrada", em: agora(), autor: null, dados: { origem: x.origem ?? "WHATSAPP" } }], ...x,
  });
  return {
    areas: [salao, churras, area("Quadra", { modelo: "QUADRA", reserva: "AUTOMATICA", antecedenciaMax: 7, horaInicio: "07:00", modo: "BLOCOS", blocoMinutos: 60 }),
      area("Academia", { modelo: "ACADEMIA", reserva: "SEM_RESERVA", horaInicio: "06:00", horaFim: "23:00" }),
      area("Espaço gourmet", { modelo: "GOURMET", horaInicio: "11:00", horaFim: "23:00", capacidade: 20 })],
    reservas: [
      r(14, salao, unidades[0]!, dia(6), { observacao: "aniversário, 60 pessoas" }),
      r(15, salao, unidades[1]!, dia(6), { origem: "PAINEL" }),
      r(13, churras, unidades[2]!, dia(7), { estado: "CONFIRMADA" }),
    ],
    unidades,
    numero: 15,
  };
}

export function resumoVida(v: EstadoVida) {
  const aAprovar = v.reservas.filter((r) => r.estado === "A_APROVAR");
  const porDia = new Map<string, { data: string; area: string; pedidos: number }>();
  for (const r of aAprovar) {
    const area = v.areas.find((a) => a.id === r.areaId)!.nome;
    const k = `${r.data}-${area}`;
    porDia.set(k, { data: r.data, area, pedidos: (porDia.get(k)?.pedidos ?? 0) + 1 });
  }
  return { reservasAAprovar: aAprovar.length, proximasAAprovar: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3) };
}

function reservaJson(v: EstadoVida, r: ReservaFalsa) {
  const a = v.areas.find((x) => x.id === r.areaId)!;
  const { areaId: _a, historico: _h, ...resto } = r;
  const outros = v.reservas.filter((x) => x.areaId === r.areaId && x.data === r.data && x.estado === "A_APROVAR" && x.id !== r.id).length;
  return {
    ...resto, area: { id: a.id, nome: a.nome, reserva: a.reserva },
    ...(r.estado === "A_APROVAR" && outros ? { outrosPedidos: outros } : {}),
    ...(a.limiteQuantidade && (r.estado === "A_APROVAR" || r.estado === "CONFIRMADA")
      ? { limite: { n: 1, quantidade: a.limiteQuantidade, periodo: a.limitePeriodo } } : {}),
  };
}

export async function rotasVida(route: Route, v: EstadoVida, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (!/^\/v1\/condominio\/(areas-comuns|reservas)/.test(caminho)) return null;
  const hoje = dia(0);

  if (caminho === "/v1/condominio/areas-comuns" && metodo === "GET") {
    if (!pode("config.ver")) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: { areas: v.areas, documentos: [{ id: novoId(), titulo: "Regimento interno" }], pode: { editar: pode("config.editar") } } });
  }
  const area = /^\/v1\/condominio\/areas-comuns(?:\/([^/]+))?$/.exec(caminho);
  if (area && (metodo === "POST" || metodo === "PUT")) {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    const nome = String(corpo.nome ?? "").trim();
    if (nome.length < 2 || v.areas.some((a) => a.id !== area[1] && a.nome.toLowerCase() === nome.toLowerCase())) {
      return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    }
    const dados = { ...corpo, nome } as Partial<AreaFalsa>;
    for (const k of Object.keys(dados) as (keyof AreaFalsa)[]) if (dados[k] === null) delete dados[k];
    if (area[1]) {
      const a = v.areas.find((x) => x.id === area[1]);
      if (!a) return erro(route, 404, "NOT_FOUND");
      if (corpo.versao !== a.versao) return erro(route, 409, "VERSION_CONFLICT");
      Object.assign(a, { ...dados, versao: a.versao + 1 });
      return route.fulfill({ json: { id: a.id, versao: a.versao } });
    }
    const nova = { ...(dados as AreaFalsa), id: novoId(), criadaPeloSindico: true, versao: 1 };
    v.areas.push(nova);
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }

  const semana = /^\/v1\/condominio\/areas-comuns\/([^/]+)\/semana$/.exec(caminho);
  if (semana) {
    const a = v.areas.find((x) => x.id === semana[1]);
    if (!a) return erro(route, 404, "NOT_FOUND");
    const de = url.searchParams.get("de")!;
    const dias = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${de}T12:00:00Z`) + i * 86400_000).toISOString().slice(0, 10));
    return route.fulfill({ json: {
      area: a, hoje,
      dias: dias.map((d) => ({
        data: d,
        reservas: v.reservas.filter((r) => r.areaId === a.id && r.data === d && (r.estado === "A_APROVAR" || r.estado === "CONFIRMADA"))
          .map((r) => ({ id: r.id, protocolo: r.protocolo, estado: r.estado, unidade: r.unidade.nome, horaInicio: r.horaInicio })),
        bloqueios: [],
      })),
    } });
  }

  if (!pode("reservas.ver")) return erro(route, 403, "FORBIDDEN");
  const ativas = v.areas.filter((a) => a.ativa && a.reserva !== "SEM_RESERVA");

  if (caminho === "/v1/condominio/reservas" && metodo === "GET") {
    const filtro = url.searchParams.get("filtro") ?? "A_APROVAR";
    const areaId = url.searchParams.get("areaId");
    const lista = v.reservas.filter((r) => (!areaId || r.areaId === areaId)
      && (filtro === "A_APROVAR" ? r.estado === "A_APROVAR" : filtro === "PROXIMAS" ? (r.estado === "A_APROVAR" || r.estado === "CONFIRMADA") && r.data >= hoje : true))
      .sort((a, b) => a.data.localeCompare(b.data) || a.protocolo.localeCompare(b.protocolo));
    return route.fulfill({ json: {
      reservas: lista.map((r) => reservaJson(v, r)), aAprovar: v.reservas.filter((r) => r.estado === "A_APROVAR").length,
      areas: ativas.map((a) => ({ id: a.id, nome: a.nome, ativa: a.ativa, reserva: a.reserva, modo: a.modo })), hoje, pode: { editar: pode("reservas.editar") },
    } });
  }
  if (caminho === "/v1/condominio/reservas/opcoes") return route.fulfill({ json: { areas: ativas, unidades: v.unidades, hoje } });
  if (caminho === "/v1/condominio/reservas/conferir") {
    const a = v.areas.find((x) => x.id === url.searchParams.get("areaId"))!;
    const data = url.searchParams.get("data")!;
    const ocupa = v.reservas.find((r) => r.areaId === a.id && r.data === data && r.estado === "CONFIRMADA");
    const conferencia = ocupa
      ? { erro: "OCUPADA", ocupacao: { motivo: "RESERVA", id: ocupa.id, titulo: `Reserva ${ocupa.protocolo} · ${ocupa.unidade.nome}` } }
      : { inicio: `${a.horaInicio}:00`, fim: `${a.horaFim}:00`, tolerancia: false };
    return route.fulfill({ json: { conferencia, ...(url.searchParams.get("unidadeId") && a.limiteQuantidade ? { noPeriodo: 0 } : {}) } });
  }
  if (caminho === "/v1/condominio/reservas" && metodo === "POST") {
    const a = ativas.find((x) => x.id === corpo.areaId);
    const u = v.unidades.find((x) => x.id === corpo.unidadeId);
    if (!a || !u) return erro(route, 400, "VALIDATION_ERROR", { campos: [a ? "unidadeId" : "areaId"] });
    const r: ReservaFalsa = {
      id: novoId(), protocolo: `2026-R${String(++v.numero).padStart(3, "0")}`, areaId: a.id, unidade: { id: u.id, nome: u.nome },
      contato: u.contatos.find((c) => c.id === corpo.contatoId), data: String(corpo.data), horaInicio: a.horaInicio, horaFim: a.horaFim,
      estado: a.reserva === "AUTOMATICA" ? "CONFIRMADA" : "A_APROVAR", origem: "PAINEL", tolerancia: false, observacao: (corpo.observacao as string) || undefined,
      criadoEm: agora(), versao: 1, historico: [{ acao: "reserva.registrada", em: agora(), autor: eu.nome, dados: { origem: "PAINEL" } }],
    };
    v.reservas.push(r);
    return route.fulfill({ status: 201, json: { id: r.id, protocolo: r.protocolo, estado: r.estado } });
  }

  const uma = /^\/v1\/condominio\/reservas\/([^/]+)(?:\/(aprovar|recusar|cancelar))?$/.exec(caminho);
  const r = uma ? v.reservas.find((x) => x.id === uma[1]) : undefined;
  if (!uma || !r) return erro(route, 404, "NOT_FOUND");
  if (!uma[2]) {
    return route.fulfill({ json: {
      reserva: reservaJson(v, r), historico: [...r.historico].reverse(), mensagens: [],
      pode: { editar: pode("reservas.editar") && (r.estado === "A_APROVAR" || r.estado === "CONFIRMADA") },
    } });
  }
  if (!pode("reservas.editar")) return erro(route, 403, "FORBIDDEN");
  if (corpo.versao !== r.versao) return erro(route, 409, "VERSION_CONFLICT");
  const decidir = (x: ReservaFalsa, estado: ReservaFalsa["estado"], motivo?: string) => {
    x.historico.push({ acao: "estado.mudou", em: agora(), autor: eu.nome, dados: { de: x.estado, para: estado, ...(motivo ? { motivo } : {}) } });
    Object.assign(x, { estado, decisao: { em: agora(), por: eu.nome, ...(motivo ? { motivo } : {}) }, versao: x.versao + 1 });
  };
  if (uma[2] === "aprovar") {
    if (r.estado !== "A_APROVAR") return erro(route, 400, "VALIDATION_ERROR", { motivo: "RESERVA_DECIDIDA" });
    decidir(r, "CONFIRMADA");
    const outras = v.reservas.filter((x) => x.areaId === r.areaId && x.data === r.data && x.estado === "A_APROVAR");
    for (const x of outras) decidir(x, "RECUSADA", "A data ficou com outro pedido de reserva");
    return route.fulfill({ json: { versao: r.versao, recusadas: outras.length } });
  }
  const motivo = String(corpo.motivo ?? "").trim();
  if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
  decidir(r, uma[2] === "recusar" ? "RECUSADA" : "CANCELADA", motivo);
  return route.fulfill({ json: { versao: r.versao } });
}

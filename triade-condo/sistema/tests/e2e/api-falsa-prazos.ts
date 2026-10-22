// Parte de prazos, avisos e indicadores da API falsa da Plataforma (passos 6 e 7). As regras
// de verdade estão testadas no banco (pgTAP 013) e na API (Deno); aqui só o bastante para a tela.
import type { Route } from "@playwright/test";
import { AGORA } from "./api-falsa-pedidos";

const HORA = 3600_000;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();
let n = 0;
const novoId = () => `7e8f9a0b-1c2d-4e3f-8a4b-${String(++n).padStart(12, "0")}`;

interface PedidoFalso { id: string; protocolo: string; assunto: string; privado: boolean; responsavelId: string | null; proximoRetorno: string | null }
interface Pessoa { vinculoId: string; nome: string; funcao: string; cargo: string | null }
export interface RegrasAvisoFalsas { sindicoHoras: number; substitutoHoras: number; substitutoId: string | null; semResponsavelHoras: number; pendenciaDias: number }
interface AvisoFalso { id: string; para: string; tipo: string; pedidoId: string; referencia: string; criadoEm: string; vistoEm: string | null }

export function regrasAvisoIniciais(): RegrasAvisoFalsas {
  return { sindicoHoras: 2, substitutoHoras: 8, substitutoId: null, semResponsavelHoras: 4, pendenciaDias: 3 };
}

/** O pedido 1 venceu há 4 h: a Bruna foi avisada na hora e a Ana 2 h depois. O pedido 3 está sem responsável. */
export function criarAvisos(pedidos: PedidoFalso[], vAna: string, vBruna: string): AvisoFalso[] {
  const [p1, , p3] = pedidos;
  return [
    { id: novoId(), para: vBruna, tipo: "RETORNO_VENCIDO", pedidoId: p1!.id, referencia: p1!.proximoRetorno!, criadoEm: depois(-4), vistoEm: null },
    { id: novoId(), para: vAna, tipo: "ESCALADO_SINDICO", pedidoId: p1!.id, referencia: p1!.proximoRetorno!, criadoEm: depois(-2), vistoEm: null },
    { id: novoId(), para: vAna, tipo: "SEM_RESPONSAVEL", pedidoId: p3!.id, referencia: depois(-48), criadoEm: depois(-44), vistoEm: null },
  ];
}

/** O mês fechado: setembro, fixo. */
export const MES_FECHADO = {
  mes: "2026-09", de: "2026-09-01", ate: "2026-09-30", retornos: { total: 43, noPrazo: 37, porcentagem: 86 },
  primeiroRetornoHoras: 3, registrados: 45, concluidos: 41, reabertos: 2, porcentagemAnterior: 79,
};

export function naoVistos(avisos: AvisoFalso[], eu: string) {
  return avisos.filter((a) => a.para === eu && !a.vistoEm).length;
}

export function escalado(avisos: AvisoFalso[], pedidoId: string | undefined) {
  return !!pedidoId && avisos.some((a) => a.pedidoId === pedidoId && a.tipo === "ESCALADO_SINDICO");
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** Atende as rotas dos passos 6 e 7; devolve null quando a rota não é daqui. */
export async function rotasPrazos(route: Route, estado: {
  avisos: AvisoFalso[]; regras: RegrasAvisoFalsas; config: { versao: number }; pedidos: PedidoFalso[]; pessoas: Pessoa[];
}, eu: { vinculo: string; nome: string }, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean,
vencido: (id: string) => boolean, outros?: { avisos: () => ({ id: string; criadoEm: string; vistoEm: string | null } & Record<string, unknown>)[];
  marcar: (ids: string[] | null) => number }): Promise<void | null> {
  const nomeDe = (v: string | null) => estado.pessoas.find((p) => p.vinculoId === v)?.nome ?? null;
  if (caminho === "/v1/condominio/avisos" && metodo === "GET") {
    const extras = outros?.avisos() ?? [];
    const itens = [...estado.avisos.filter((a) => a.para === eu.vinculo)
      .map((a) => {
        const p = estado.pedidos.find((x) => x.id === a.pedidoId)!;
        return { id: a.id, tipo: a.tipo, pedidoId: p.id, protocolo: p.protocolo, assunto: p.privado && !pode("pedidos.revisar") ? null : p.assunto,
          responsavel: nomeDe(p.responsavelId), referencia: a.referencia, criadoEm: a.criadoEm, vistoEm: a.vistoEm };
      }), ...extras]
      .sort((a, b) => Number(!!a.vistoEm) - Number(!!b.vistoEm) || b.criadoEm.localeCompare(a.criadoEm));
    return route.fulfill({ json: { itens, naoVistos: naoVistos(estado.avisos, eu.vinculo) + extras.filter((a) => !a.vistoEm).length } });
  }
  if (caminho === "/v1/condominio/avisos/vistos" && metodo === "POST") {
    const ids = Array.isArray(corpo.ids) ? corpo.ids.map(String) : null;
    let marcados = 0;
    for (const a of estado.avisos) {
      if (a.para === eu.vinculo && !a.vistoEm && (!ids || ids.includes(a.id))) { a.vistoEm = AGORA; marcados++; }
    }
    return route.fulfill({ json: { marcados: marcados + (outros?.marcar(ids) ?? 0) } });
  }
  if (caminho === "/v1/condominio/regras-aviso" && metodo === "PUT") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== estado.config.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: estado.config.versao });
    if (Number(corpo.substitutoHoras) <= Number(corpo.sindicoHoras)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["substitutoHoras"] });
    estado.regras = {
      sindicoHoras: Number(corpo.sindicoHoras), substitutoHoras: Number(corpo.substitutoHoras), substitutoId: (corpo.substitutoId as string | null) ?? null,
      semResponsavelHoras: Number(corpo.semResponsavelHoras), pendenciaDias: Number(corpo.pendenciaDias),
    };
    estado.config.versao++;
    return route.fulfill({ json: { versao: estado.config.versao } });
  }
  const prazo = /^\/v1\/condominio\/pedidos\/([^/]+)\/prazo$/.exec(caminho);
  if (prazo) {
    const p = estado.pedidos.find((x) => x.id === prazo[1]);
    if (!p) return erro(route, 404, "NOT_FOUND");
    if (!vencido(p.id)) return route.fulfill({ json: { vencido: false } });
    const deste = estado.avisos.filter((a) => a.pedidoId === p.id && a.referencia === p.proximoRetorno && a.tipo !== "SEM_RESPONSAVEL");
    const avisos = ["RETORNO_VENCIDO", "ESCALADO_SINDICO", "ESCALADO_SUBSTITUTO"].flatMap((tipo) => {
      const xs = deste.filter((a) => a.tipo === tipo);
      return xs.length ? [{ tipo, em: xs[0]!.criadoEm, nomes: xs.map((a) => nomeDe(a.para)) }] : [];
    });
    const sub = estado.regras.substitutoId;
    const proximo = !deste.some((a) => a.tipo === "ESCALADO_SINDICO") && p.responsavelId
      ? { tipo: "ESCALADO_SINDICO", em: new Date(Date.parse(p.proximoRetorno!) + estado.regras.sindicoHoras * HORA).toISOString() }
      : sub && !deste.some((a) => a.tipo === "ESCALADO_SUBSTITUTO")
        ? { tipo: "ESCALADO_SUBSTITUTO", em: new Date(Date.parse(p.proximoRetorno!) + estado.regras.substitutoHoras * HORA).toISOString() } : null;
    const horas = Math.round((Date.parse(AGORA) - Date.parse(p.proximoRetorno!)) / HORA * 10) / 10;
    return route.fulfill({ json: { vencido: true, desde: p.proximoRetorno, horas, avisos, proximo } });
  }
  if (caminho === "/v1/condominio/indicadores") {
    if (!pode("pedidos.ver")) return erro(route, 403, "FORBIDDEN");
    const periodo = url.searchParams.get("periodo") ?? "ESTE_MES";
    // TR-01: as pendências são de agora; o tempo de solução segue o período.
    const pendencias = [
      { responsavelId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", nome: "Ana Souza", abertos: 2, retornoVencido: 1, maisAntigoDias: 12 },
      { responsavelId: null, nome: null, abertos: 1, retornoVencido: 1, maisAntigoDias: 1 },
    ];
    const solucao = periodo === "ESTE_MES"
      ? [{ categoriaId: novoId(), nome: "Manutenção", concluidos: 3, medianaHoras: 52, maisDemoradoHoras: 144 },
        { categoriaId: novoId(), nome: "Limpeza", concluidos: 0, medianaHoras: null, maisDemoradoHoras: null }]
      : [{ categoriaId: novoId(), nome: "Limpeza", concluidos: 9, medianaHoras: 5, maisDemoradoHoras: 26 },
        { categoriaId: novoId(), nome: "Manutenção", concluidos: 29, medianaHoras: 52, maisDemoradoHoras: 144 }];
    // F7.4: a reincidência segue o período; das decisões, aguardando é de agora.
    const reincidencia = periodo === "ESTE_MES"
      ? { pedidos: 3, reincidencias: 1, porcentagem: 33, ondeVolta: [{ onde: "Portão da garagem", categoria: "Portaria e acesso", vezes: 1, ultima: "2026-0002" }] }
      : { pedidos: 45, reincidencias: 3, porcentagem: 7, ondeVolta: [
        { onde: "Garagem G2, vaga 31", categoria: "Hidráulica", vezes: 2, ultima: "2026-0142" },
        { onde: "Portão da garagem", categoria: "Elétrica", vezes: 1, ultima: "2026-0131" }] };
    const decisoes = { aguardando: 1, vencidas: 1, maisAntigaDias: 2,
      ...(periodo === "ESTE_MES" ? { decididas: 0, aprovadas: 0, devolvidas: 0, medianaHoras: null } : { decididas: 7, aprovadas: 5, devolvidas: 2, medianaHoras: 27 }) };
    if (periodo === "ESTE_MES") {
      return route.fulfill({ json: { periodo, porcentagemAnterior: 86, pendencias, solucao, reincidencia, decisoes, atual: {
        de: "2026-10-01", ate: "2026-10-16", retornos: { total: 0, noPrazo: 0, porcentagem: null }, primeiroRetornoHoras: null,
        registrados: 3, concluidos: 0, reabertos: 0,
        porCategoria: [{ categoriaId: novoId(), nome: "Manutenção", retornos: null, noPrazo: null, porcentagem: null, concluidos: 0 }],
      } } });
    }
    const { mes: _m, porcentagemAnterior, ...numeros } = MES_FECHADO;
    return route.fulfill({ json: { periodo, porcentagemAnterior, pendencias, solucao, reincidencia, decisoes, atual: { ...numeros, porCategoria: [
      { categoriaId: novoId(), nome: "Limpeza", retornos: 10, noPrazo: 8, porcentagem: 80, concluidos: 9 },
      { categoriaId: novoId(), nome: "Manutenção", retornos: 30, noPrazo: 27, porcentagem: 90, concluidos: 29 },
      { categoriaId: novoId(), nome: "Segurança", retornos: null, noPrazo: null, porcentagem: null, concluidos: 0 },
    ] } } });
  }
  return null;
}

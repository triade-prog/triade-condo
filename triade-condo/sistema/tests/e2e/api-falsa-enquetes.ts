// Parte das enquetes da API falsa da Plataforma (peça R12; AC-03). As regras de verdade estão
// testadas no banco (pgTAP 024) e na API (Deno); aqui só o bastante para a tela: a lista com o
// resultado, a enquete nova, encerrar, publicar o resultado, copiar um link e o link pessoal.
import type { Route } from "@playwright/test";

interface ConviteFalso { id: string; nome: string; codigo: string; respondeuEm?: string; opcao?: number; semContato?: boolean }
interface EnqueteFalsa {
  id: string; pergunta: string; opcoes: string[]; por: "UNIDADE" | "PESSOA"; secreta: boolean; abertaAte: string; canais: string[];
  lembreteEm?: string; encerradaEm?: string; encerradaPor?: string; comunicado?: { id: string; estado: string }; criadoEm: string;
  versao: number; convites: ConviteFalso[]; votos?: number[]; historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
export interface EstadoEnquetes { enquetes: EnqueteFalsa[] }

let n = 0;
const novoId = () => `8f9a0b1c-2d3e-4f4a-9b5c-${String(++n).padStart(12, "0")}`;
const em = (dias: number) => new Date(Date.now() + dias * 86400_000).toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarEnquetes(): EstadoEnquetes {
  const convite = (nome: string, codigo: string, x: Partial<ConviteFalso> = {}): ConviteFalso => ({ id: novoId(), nome, codigo, ...x });
  return {
    enquetes: [
      {
        id: novoId(), pergunta: "Qual horário para a academia aos domingos?", opcoes: ["Das 8h às 20h", "Das 6h às 22h", "Fechada aos domingos"],
        por: "UNIDADE", secreta: true, abertaAte: em(5), canais: ["WHATSAPP", "MURAL"], lembreteEm: em(3), criadoEm: em(-2), versao: 1, votos: [2, 1, 0],
        convites: [
          convite("Torre A · 101", "A1B2-C3D4-E5F6", { respondeuEm: em(-1) }),
          convite("Torre A · 102", "A2B3-C4D5-E6F7", { respondeuEm: em(-1) }),
          convite("Torre A · 201", "A3B4-C5D6-E7F8", { respondeuEm: em(-1) }),
          convite("Torre A · 302", "K7QM-3XPA-9TRE"),
          convite("Torre B · 104", "B4C5-D6E7-F8G9", { semContato: true }),
        ],
        historico: [{ acao: "enquete.criada", em: em(-2), autor: "Ana Souza", dados: { convites: 5 } }],
      },
      {
        id: novoId(), pergunta: "Pode ter festa junina no salão?", opcoes: ["Sim", "Não"], por: "PESSOA", secreta: false, abertaAte: em(-1),
        canais: ["WHATSAPP"], encerradaEm: em(-1), criadoEm: em(-9), versao: 2,
        convites: [
          convite("Marta Lima", "F8NW-2HJK-4MPQ", { respondeuEm: em(-3), opcao: 1 }),
          convite("Rafael Dias", "F9NW-3HJK-5MPQ", { respondeuEm: em(-2), opcao: 1 }),
          convite("Bruna Souza", "G1NW-4HJK-6MPQ"),
        ],
        historico: [{ acao: "enquete.criada", em: em(-9), autor: "Ana Souza", dados: { convites: 3 } },
          { acao: "enquete.encerrada", em: em(-1), autor: null, dados: { pelo: "PRAZO" } }],
      },
    ],
  };
}

const aberta = (e: EnqueteFalsa) => !e.encerradaEm && Date.parse(e.abertaAte) > Date.now();
function resultado(e: EnqueteFalsa) {
  // Na secreta, só a contagem, como no banco.
  const votos = e.secreta ? (e.votos ?? []) : e.opcoes.map((_, i) => e.convites.filter((c) => c.opcao === i + 1).length);
  return { opcoes: e.opcoes.map((texto, i) => ({ texto, votos: votos[i] ?? 0 })), responderam: e.convites.filter((c) => c.respondeuEm).length, total: e.convites.length };
}
function enqueteJson(e: EnqueteFalsa) {
  const { convites: _c, historico: _h, votos: _v, ...resto } = e;
  return { ...resto, situacao: aberta(e) ? "ABERTA" : "ENCERRADA", resultado: resultado(e) };
}

export function resumoEnquetes(v: EstadoEnquetes) {
  return v.enquetes.filter(aberta).map((e) => ({ id: e.id, pergunta: e.pergunta, abertaAte: e.abertaAte, ...resultado(e) }))
    .map(({ opcoes: _o, ...x }) => x);
}

export async function rotasEnquetes(route: Route, v: EstadoEnquetes, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (!caminho.startsWith("/v1/condominio/enquetes")) return null;
  if (!pode("enquetes.ver")) return erro(route, 403, "FORBIDDEN");

  if (caminho === "/v1/condominio/enquetes" && metodo === "GET") {
    return route.fulfill({ json: {
      enquetes: [...v.enquetes].sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.criadoEm.localeCompare(a.criadoEm)).map(enqueteJson),
      canais: { whatsapp: true, email: false, mural: true }, unidades: 5, pode: { editar: pode("enquetes.editar") },
    } });
  }
  if (!pode("enquetes.editar") && metodo !== "GET") return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/enquetes" && metodo === "POST") {
    const pergunta = String(corpo.pergunta ?? "").trim();
    const opcoes = ((corpo.opcoes as string[]) ?? []).map((o) => o.trim()).filter(Boolean);
    const campos = [
      ...(pergunta.length < 5 ? ["pergunta"] : []),
      ...(opcoes.length < 2 || new Set(opcoes.map((o) => o.toLowerCase())).size !== opcoes.length ? ["opcoes"] : []),
      ...((corpo.canais as string[] | undefined)?.length ? [] : ["canais"]),
    ];
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const unidades = ["Torre A · 101", "Torre A · 102", "Torre A · 201", "Torre A · 302", "Torre B · 104"];
    const e: EnqueteFalsa = {
      id: novoId(), pergunta, opcoes, por: corpo.por as "UNIDADE", secreta: Boolean(corpo.secreta), abertaAte: String(corpo.abertaAte),
      canais: corpo.canais as string[], criadoEm: new Date().toISOString(), versao: 1, votos: opcoes.map(() => 0),
      convites: unidades.map((u, i) => ({ id: novoId(), nome: u, codigo: `N${i}AA-BBBB-CCCC` })),
      historico: [{ acao: "enquete.criada", em: new Date().toISOString(), autor: eu.nome, dados: { convites: unidades.length } }],
    };
    v.enquetes.push(e);
    return route.fulfill({ status: 201, json: { id: e.id, versao: 1, convites: unidades.length, envios: 4 } });
  }

  const m = /^\/v1\/condominio\/enquetes\/([^/]+)(?:\/(encerrar|publicar|link))?$/.exec(caminho);
  const e = m ? v.enquetes.find((x) => x.id === m[1]) : undefined;
  if (!m || !e) return erro(route, 404, "NOT_FOUND");
  if (!m[2]) {
    return route.fulfill({ json: {
      enquete: enqueteJson(e),
      convites: e.convites.map(({ codigo: _c, opcao, ...c }) => ({ ...c, ...(e.secreta ? {} : { opcao }) })),
      historico: [...e.historico].reverse(), pode: { editar: pode("enquetes.editar") },
    } });
  }
  if (m[2] === "link") {
    const c = e.convites.find((x) => x.id === corpo.conviteId);
    if (!c) return erro(route, 404, "NOT_FOUND");
    e.historico.push({ acao: "enquete.link_gerado", em: new Date().toISOString(), autor: eu.nome, dados: { para: c.nome } });
    return route.fulfill({ json: { codigo: c.codigo } });
  }
  if (corpo.versao !== e.versao) return erro(route, 409, "VERSION_CONFLICT");
  if (m[2] === "encerrar") {
    if (!aberta(e)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ENQUETE_FECHADA" });
    Object.assign(e, { encerradaEm: new Date().toISOString(), encerradaPor: eu.nome, versao: e.versao + 1 });
    e.historico.push({ acao: "enquete.encerrada", em: e.encerradaEm!, autor: eu.nome, dados: { pelo: "SINDICO" } });
    return route.fulfill({ json: { versao: e.versao } });
  }
  if (aberta(e)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ENQUETE_ABERTA" });
  e.comunicado = e.comunicado ?? { id: novoId(), estado: "RASCUNHO" };
  e.historico.push({ acao: "enquete.resultado_publicado", em: new Date().toISOString(), autor: eu.nome, dados: {} });
  return route.fulfill({ json: { comunicadoId: e.comunicado.id, versao: e.versao } });
}

/** O link pessoal, sem conta. */
export async function rotasEnquetePublica(route: Route, v: EstadoEnquetes, caminho: string, metodo: string, corpo: Record<string, unknown>): Promise<unknown> {
  const m = /^\/v1\/publico\/v\/([^/]+)$/.exec(caminho);
  if (!m) return null;
  const e = v.enquetes.find((x) => x.convites.some((c) => c.codigo === m[1]));
  const c = e?.convites.find((x) => x.codigo === m[1]);
  if (!e || !c) return erro(route, 404, "NOT_FOUND");
  const json = () => ({
    condominio: "Residencial Ipê", pergunta: e.pergunta, opcoes: e.opcoes, por: e.por, secreta: e.secreta, abertaAte: e.abertaAte, aberta: aberta(e),
    para: c.nome, ...(c.respondeuEm ? { respondeuEm: c.respondeuEm } : {}),
    ...(c.opcao && (aberta(e) || !e.secreta) ? { escolha: c.opcao } : {}), ...(aberta(e) ? {} : { resultado: resultado(e) }),
  });
  if (metodo === "GET") return route.fulfill({ json: json() });
  if (!aberta(e)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ENQUETE_FECHADA" });
  const opcao = Number(corpo.opcao);
  if (!(opcao >= 1 && opcao <= e.opcoes.length)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["opcao"] });
  if (e.votos) {
    if (c.opcao) e.votos[c.opcao - 1]! -= 1;
    e.votos[opcao - 1]! += 1;
  }
  Object.assign(c, { respondeuEm: new Date().toISOString(), opcao });
  return route.fulfill({ json: json() });
}

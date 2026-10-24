// Parte do relatório do mês da API falsa da Plataforma (TR-02, TR-05, TR-08, TR-10). As regras de
// verdade estão testadas no banco (pgTAP 038) e na API (Deno); aqui só o bastante para a tela:
// a lista, a prévia, gerar com versão, o modelo, os anexos e os links de 5 minutos.
import type { Route } from "@playwright/test";
import { conteudoEnviado } from "./api-falsa-arquivos";

const PARTES = ["RESUMO", "ATENDIMENTO", "CATEGORIA", "TORRE", "DECISOES", "REINCIDENCIA", "PALAVRA"];
interface AnexoFalso { ordem: number; titulo: string; tipo: string; origem: "ENVIADO" | "DOCUMENTO"; arquivoId?: string; documentoId?: string }
interface RelatorioFalso {
  id: string; mes: string; numero: number; partes: string[]; resumo: string | null; palavra: string | null; conteudo: Record<string, unknown>;
  geradoEm: string; autor: string; anexos: AnexoFalso[];
}
export interface EstadoRelatorios {
  gerados: RelatorioFalso[];
  modelo: { partes: string[]; guardadoEm?: string; guardadoPor?: string };
  enviados: Map<string, { nome: string; tipo: string; liberado: boolean }>;
  baixados: { id: string; formato: string }[];
}

let n = 0;
const novoId = () => `8f9a0b1c-2d3e-4f4a-9b5c-${String(++n).padStart(12, "0")}`;

export const criarRelatorios = (): EstadoRelatorios => ({
  gerados: [], modelo: { partes: PARTES.filter((p) => p !== "REINCIDENCIA") }, enviados: new Map(), baixados: [],
});

/** Um PDF de uma página, com a tabela de referências certa, para o navegador juntar ao relatório. */
function pdfDeUmaPagina(): Buffer {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>"];
  let s = "%PDF-1.4\n";
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  s += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(s, "latin1");
}

const LINHA = (chave: string, nome: string, registrados: number, concluidos: number, tempoMedioHoras: number | null, retornos: number, noPrazo: number) =>
  ({ chave, nome, registrados, concluidos, tempoMedioHoras, retornos, noPrazo, porcentagem: retornos ? Math.round((100 * noPrazo) / retornos) : null });

function numeros(mes: string, podeDecidir: boolean) {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const ate = `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const setembro = mes === "2026-09";
  const at = (r: number, c: number, total: number, noPrazo: number) => ({
    registrados: r, concluidos: c, reabertos: r ? 2 : 0, retornos: { total, noPrazo, porcentagem: total ? Math.round((100 * noPrazo) / total) : null }, primeiroRetornoHoras: total ? 3 : null,
  });
  return {
    mes, de: `${mes}-01`, ate, fuso: "America/Sao_Paulo", condominio: "Residencial Ipê",
    foraPorPermissao: podeDecidir ? [] : ["DECISOES"],
    atendimento: { atual: setembro ? at(45, 41, 43, 37) : at(0, 0, 0, 0), anterior: setembro ? at(38, 35, 38, 30) : at(0, 0, 0, 0) },
    categorias: setembro
      ? [LINHA("c1", "Manutenção", 20, 18, 36, 18, 15), LINHA("c2", "Limpeza", 9, 9, 6, 9, 9), LINHA("c3", "Barulho e convivência", 16, 14, 50, 16, 13)]
      : [LINHA("c1", "Manutenção", 0, 0, null, 0, 0)],
    torres: setembro
      ? [LINHA("A", "Torre A", 21, 19, 30, 20, 17), LINHA("B", "Torre B", 18, 16, 40, 17, 15), LINHA("AREAS_COMUNS", "Áreas comuns e sem unidade", 6, 6, 12, 6, 5)]
      : [LINHA("AREAS_COMUNS", "Áreas comuns e sem unidade", 0, 0, null, 0, 0)],
    ...(podeDecidir ? { decisoes: { pedidas: 6, decididas: 5, aprovadas: 4, devolvidas: 1, medianaHoras: setembro ? 20 : null, aguardandoNoFim: 1,
      ...(setembro ? { peloConselho: 2, despesas: { pedidas: 3, aprovadas: 2, recusadas: 1, valorAprovado: 920000, aguardandoNoFim: 0 } } : {}) } } : {}),
    reincidencia: { pedidos: setembro ? 45 : 0, reincidencias: setembro ? 3 : 0, porcentagem: setembro ? 7 : null,
      ondeVolta: setembro ? [{ onde: "Garagem G1", categoria: "Manutenção", vezes: 2 }] : [] },
  };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** O arquivo por trás do link de 5 minutos: o enviado aqui, ou um PDF de uma página para o documento. */
export async function rotasArquivoRelatorio(route: Route, caminho: string): Promise<unknown> {
  const r = /^\/v1\/relatorios-falsos\/(DOC|ARQ)\/([^/]+)$/.exec(caminho);
  if (!r) return null;
  if (r[1] === "DOC") return route.fulfill({ status: 200, body: pdfDeUmaPagina(), contentType: "application/pdf" });
  return route.fulfill({ status: 200, body: conteudoEnviado(r[2]!), contentType: "application/octet-stream" });
}

export async function rotasRelatorios(route: Route, est: EstadoRelatorios, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL,
  pode: (a: string) => boolean, eu: { nome: string }, documentos: () => { id: string; titulo: string; nome?: string; tipo?: string }[]): Promise<unknown> {
  if (!caminho.startsWith("/v1/condominio/relatorios")) return null;
  if (!pode("pedidos.ver")) return erro(route, 403, "FORBIDDEN");
  const podeDecidir = pode("decisoes.aprovar");
  const ultimo = (r: RelatorioFalso) => r.numero === Math.max(...est.gerados.filter((x) => x.mes === r.mes).map((x) => x.numero));

  if (caminho === "/v1/condominio/relatorios" && metodo === "GET") {
    return route.fulfill({ json: {
      mesFechado: "2026-09", mesFechadoGerado: est.gerados.some((r) => r.mes === "2026-09"), meses: ["2026-09", "2026-08", "2026-07"], modelo: est.modelo,
      gerados: [...est.gerados].sort((x, y) => y.mes.localeCompare(x.mes) || y.numero - x.numero)
        .map((r) => ({ id: r.id, mes: r.mes, numero: r.numero, partes: r.partes, anexos: r.anexos.length, geradoEm: r.geradoEm, autor: r.autor, ultimo: ultimo(r) })),
      pode: { decisoes: podeDecidir, documentos: pode("documentos.ver") },
    } });
  }
  if (caminho === "/v1/condominio/relatorios/previa") {
    const mes = url.searchParams.get("mes") ?? "";
    if (mes === "2026-10") return erro(route, 400, "VALIDATION_ERROR", { motivo: "MES_EM_ANDAMENTO" });
    const nums = est.gerados.filter((r) => r.mes === mes).map((r) => r.numero);
    return route.fulfill({ json: { ...numeros(mes, podeDecidir), ultimoNumero: nums.length ? Math.max(...nums) : null } });
  }
  if (caminho === "/v1/condominio/relatorios/anexos" && metodo === "POST") {
    if (!["image/jpeg", "image/png", "application/pdf"].includes(String(corpo.tipo))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO_RELATORIO" });
    const id = novoId();
    est.enviados.set(id, { nome: String(corpo.nome), tipo: String(corpo.tipo), liberado: false });
    return route.fulfill({ status: 201, json: { arquivoId: id, envio: { url: `/api/v1/armazenamento/${id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  const v = /^\/v1\/condominio\/relatorios\/anexos\/([^/]+)\/verificar$/.exec(caminho);
  if (v) {
    const a = est.enviados.get(v[1]!);
    if (!a) return erro(route, 404, "NOT_FOUND");
    a.liberado = true;
    return route.fulfill({ json: { situacao: "LIBERADO" } });
  }
  if (caminho === "/v1/condominio/relatorios" && metodo === "POST") {
    const mes = String(corpo.mes);
    const partes = (corpo.partes as string[]).filter((p) => PARTES.includes(p));
    if (!podeDecidir && partes.includes("DECISOES")) return erro(route, 403, "FORBIDDEN");
    const anexos = (corpo.anexos as { arquivoId?: string; documentoId?: string }[]).map((x, i): AnexoFalso => {
      if (x.documentoId) {
        const d = documentos().find((y) => y.id === x.documentoId)!;
        return { ordem: i + 1, titulo: d.titulo, tipo: "application/pdf", origem: "DOCUMENTO", documentoId: d.id };
      }
      const a = est.enviados.get(x.arquivoId!) ?? est.gerados.flatMap((r) => r.anexos).find((y) => y.arquivoId === x.arquivoId);
      return { ordem: i + 1, titulo: "nome" in a! ? a.nome : a!.titulo, tipo: a!.tipo, origem: "ENVIADO", arquivoId: x.arquivoId };
    });
    const numero = Math.max(0, ...est.gerados.filter((r) => r.mes === mes).map((r) => r.numero)) + 1;
    const r: RelatorioFalso = {
      id: novoId(), mes, numero, partes: PARTES.filter((p) => partes.includes(p)), resumo: (corpo.resumo as string) ?? null, palavra: (corpo.palavra as string) ?? null,
      conteudo: { ...numeros(mes, podeDecidir), autor: { nome: eu.nome, cargo: "Síndica", sindico: true } }, geradoEm: new Date().toISOString(), autor: eu.nome, anexos,
    };
    est.gerados.push(r);
    if (corpo.guardarModelo) est.modelo = { partes: r.partes, guardadoEm: r.geradoEm, guardadoPor: eu.nome };
    return route.fulfill({ status: 201, json: { id: r.id, mes, numero } });
  }
  const um = /^\/v1\/condominio\/relatorios\/([^/]+)(?:\/(baixado)|\/anexos\/(\d+)\/link)?$/.exec(caminho);
  const r = um ? est.gerados.find((x) => x.id === um[1]) : undefined;
  if (!um || !r) return erro(route, 404, "NOT_FOUND");
  if (um[2]) { est.baixados.push({ id: r.id, formato: String(corpo.formato) }); return route.fulfill({ json: null }); }
  if (um[3]) {
    const a = r.anexos.find((x) => x.ordem === Number(um[3]));
    if (!a) return erro(route, 404, "NOT_FOUND");
    const url = a.origem === "DOCUMENTO" ? `/api/v1/relatorios-falsos/DOC/${a.documentoId}` : `/api/v1/relatorios-falsos/ARQ/${a.arquivoId}`;
    return route.fulfill({ json: { url, nome: a.titulo, tipo: a.tipo, expiraEm: new Date(Date.now() + 300_000).toISOString() } });
  }
  const { autor: _a, ...resto } = r;
  return route.fulfill({ json: { ...resto, ultimo: ultimo(r) } });
}

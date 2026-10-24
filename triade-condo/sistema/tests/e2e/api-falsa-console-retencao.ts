// Retenção de dados do Console falsa (F0.11; quadros 356 a 358): o modo da rotina (nasce só
// contando; só a Administração liga a exclusão), as rodadas por cliente, a fila de arquivos, os 32
// tipos e os clientes que saíram (ainda nenhum). Os nomes dos clientes são fictícios (PT-14). As
// regras de verdade estão no banco (pgTAP 044) e na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";
import { hojeAs0310, TIPOS_RETENCAO } from "./api-falsa-privacidade";

type Json = Record<string, unknown>;

const AGUAS = "8f4a5b6c-7d8e-4f9a-8b0c-3d4e5f6a7b81";
const JARDINS = "8f4a5b6c-7d8e-4f9a-8b0c-3d4e5f6a7b82";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";

export function criarRetencaoConsole() {
  const cliente = (condominioId: string, nome: string, itens: Record<string, number>, arquivos: number, erro?: string) =>
    ({ condominioId, nome, itens, total: Object.values(itens).reduce((a, b) => a + b, 0), arquivos, ...(erro ? { erro } : {}) });
  const rodada = (id: number, dias: number, clientes: ReturnType<typeof cliente>[]) => ({
    id, em: hojeAs0310(dias), modo: "CONTANDO", total: clientes.reduce((a, c) => a + c.total, 0), arquivos: clientes.reduce((a, c) => a + c.arquivos, 0),
    erros: clientes.filter((c) => c.erro).length, clientes,
  });
  return {
    modo: "CONTANDO" as "CONTANDO" | "APAGANDO",
    mudadoEm: null as string | null,
    mudadoPor: null as string | null,
    versao: 1,
    rodadas: [
      rodada(2, 0, [
        cliente(IPE, "Residencial Ipê", {}, 0, "O armazenamento não respondeu ao apagar uma foto de pedido"),
        cliente(AGUAS, "Condomínio Águas Claras", { MENSAGEM: 30, ENVIO: 12, EXPORTACAO: 1, VEICULO: 3 }, 13),
        cliente(JARDINS, "Residencial Jardins", { ENVIO: 8 }, 0),
      ]),
      rodada(1, 1, [
        cliente(AGUAS, "Condomínio Águas Claras", { MENSAGEM: 35, ENVIO: 16 }, 9),
        cliente(JARDINS, "Residencial Jardins", { CLASSIFICADO: 3 }, 0),
      ]),
    ] as Json[],
    arquivos: { naFila: 13, comErro: 1 },
    /** Os pedidos de mudar o modo, para o teste conferir. */
    mudancas: [] as string[],
  };
}

export type RetencaoFalsa = ReturnType<typeof criarRetencaoConsole>;

function erro(route: Route, status: number, codigo: string, detalhes?: Json) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** As rotas de /v1/retencao. Devolve null quando o caminho não é daqui. */
export async function rotasRetencaoConsole(route: Route, r: RetencaoFalsa, caminho: string, metodo: string, corpo: Json, admin: boolean) {
  if (!caminho.startsWith("/v1/retencao")) return null;
  if (!admin) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/retencao" && metodo === "GET") {
    return route.fulfill({ json: { modo: r.modo, mudadoEm: r.mudadoEm, mudadoPor: r.mudadoPor, versao: r.versao, podeLigar: true, rodadas: r.rodadas,
      arquivos: r.arquivos, tipos: TIPOS_RETENCAO, saidas: [] } });
  }
  if (caminho === "/v1/retencao/modo" && metodo === "PUT") {
    if (!["CONTANDO", "APAGANDO"].includes(String(corpo.modo))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["modo"] });
    if (corpo.versao !== r.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: r.versao });
    Object.assign(r, { modo: corpo.modo, mudadoEm: new Date().toISOString(), mudadoPor: "Carolina", versao: r.versao + 1 });
    r.mudancas.push(String(corpo.modo));
    return route.fulfill({ json: { modo: r.modo, mudadoEm: r.mudadoEm, mudadoPor: r.mudadoPor, versao: r.versao } });
  }
  return erro(route, 404, "NOT_FOUND");
}

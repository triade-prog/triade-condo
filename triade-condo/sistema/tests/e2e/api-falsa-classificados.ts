// Parte dos classificados da API falsa da Plataforma (peça R12; AC-05, CD-12). As regras de verdade
// estão testadas no banco (pgTAP 026) e na API (Deno); aqui só o bastante para a tela: a aba com os
// filtros, publicar, recusar, tirar do mural e a aba Classificados do mural online.
import type { Route } from "@playwright/test";

type Estado = "A_APROVAR" | "NO_MURAL" | "RECUSADO" | "RETIRADO" | "VENCIDO";
interface AnuncioFalso {
  id: string; tipo: "VENDO" | "DOO" | "PROCURO" | "SERVICO"; texto: string; estado: Estado; titulo?: string; valorCentavos?: number;
  noMuralAte?: string; tituloSugerido: string; valorSugerido?: number; mostrarTelefone: boolean; foto: boolean;
  unidade: string; bloco: string; contato: string; telefone: string; motivo?: string; versao: number; criadoEm: string;
}
export interface EstadoClassificados { anuncios: AnuncioFalso[] }

/** Um quadradinho cinza no lugar da foto. */
const FOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const dia = (dias: number) => new Date(Date.now() + dias * 86400_000).toISOString().slice(0, 10);
const json = (a: AnuncioFalso) => ({
  id: a.id, tipo: a.tipo, texto: a.texto, estado: a.estado, titulo: a.titulo, valorCentavos: a.valorCentavos, noMuralAte: a.noMuralAte,
  tituloSugerido: a.tituloSugerido, valorSugerido: a.valorSugerido, mostrarTelefone: a.mostrarTelefone, foto: a.foto,
  unidade: { id: `u-${a.id}`, nome: a.unidade }, contato: { id: `c-${a.id}`, nome: a.contato }, criadoEm: a.criadoEm,
  ...(a.estado !== "A_APROVAR" ? { decisao: { em: a.criadoEm, por: "Ana Souza" } } : {}), motivo: a.motivo, versao: a.versao,
});

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarClassificados(): EstadoClassificados {
  const criadoEm = new Date(Date.now() - 3600_000).toISOString();
  return { anuncios: [
    { id: "7c1d2e3f-4a5b-4c6d-8e7f-000000000001", tipo: "VENDO", texto: "Bicicleta aro 29, pouco usada, R$ 900", estado: "A_APROVAR",
      tituloSugerido: "Vendo bicicleta aro 29", valorSugerido: 90000, mostrarTelefone: true, foto: true, unidade: "Torre B · 201", bloco: "Torre B",
      contato: "Paulo Mendes", telefone: "5561999990001", versao: 1, criadoEm },
    { id: "7c1d2e3f-4a5b-4c6d-8e7f-000000000002", tipo: "SERVICO", texto: "Sábados de manhã, na Torre A. Primeira aula grátis.", estado: "NO_MURAL",
      titulo: "Aulas de violão para crianças", noMuralAte: dia(30), tituloSugerido: "Sábados de manhã", mostrarTelefone: true, foto: true,
      unidade: "Torre A · 104", bloco: "Torre A", contato: "Lia Prado", telefone: "5561977771212", versao: 2, criadoEm },
    { id: "7c1d2e3f-4a5b-4c6d-8e7f-000000000003", tipo: "DOO", texto: "Com colchão. Retirar na Torre A.", estado: "NO_MURAL",
      titulo: "Doo berço de madeira", noMuralAte: dia(24), tituloSugerido: "Doo com colchão", mostrarTelefone: false, foto: false,
      unidade: "Torre A · 302", bloco: "Torre A", contato: "Marta Souza", telefone: "5561955554444", versao: 2, criadoEm },
    { id: "7c1d2e3f-4a5b-4c6d-8e7f-000000000004", tipo: "PROCURO", texto: "Procuro babá para as tardes", estado: "RECUSADO",
      tituloSugerido: "Procuro babá para as tardes", mostrarTelefone: false, foto: false, unidade: "Torre A · 101", bloco: "Torre A",
      contato: "Rui Lima", telefone: "5561933332222", motivo: "Serviço de fora do prédio", versao: 2, criadoEm },
  ] };
}

export const classificadosAAprovar = (v: EstadoClassificados) => v.anuncios.filter((a) => a.estado === "A_APROVAR").length;

/** Os anúncios no mural, como o banco manda: primeiro nome e bloco; WhatsApp só com o SIM. */
export const classificadosDoMural = (v: EstadoClassificados) => v.anuncios.filter((a) => a.estado === "NO_MURAL").map((a) => ({
  id: a.id, tipo: a.tipo, titulo: a.titulo, texto: a.texto, valorCentavos: a.valorCentavos, ate: a.noMuralAte, foto: a.foto,
  quem: a.contato.split(" ")[0], bloco: a.bloco, ...(a.mostrarTelefone ? { whatsapp: a.telefone } : {}),
}));

export async function rotasClassificadoPublico(route: Route, caminho: string): Promise<unknown> {
  if (!/^\/v1\/publico\/mural\/[^/]+\/classificados\/[^/]+\/foto$/.test(caminho)) return null;
  return route.fulfill({ json: { url: FOTO, nome: "foto", tipo: "image/png" } });
}

export async function rotasClassificados(route: Route, v: EstadoClassificados, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean): Promise<unknown> {
  if (!caminho.startsWith("/v1/condominio/classificados")) return null;
  if (!pode("classificados.ver")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/classificados") {
    return route.fulfill({ json: { classificados: v.anuncios.map(json), aAprovar: classificadosAAprovar(v), pode: { editar: pode("classificados.editar") } } });
  }
  const m = /^\/v1\/condominio\/classificados\/([^/]+)\/(foto|publicar|recusar|tirar)$/.exec(caminho);
  const a = v.anuncios.find((x) => x.id === m?.[1]);
  if (!m || !a) return erro(route, 404, "NOT_FOUND");
  if (m[2] === "foto") return route.fulfill({ json: { url: FOTO, tipo: "image/png" } });
  if (metodo !== "POST" || !pode("classificados.editar")) return erro(route, 403, "FORBIDDEN");
  if (corpo.versao !== a.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: a.versao });
  if (m[2] === "publicar") {
    if (String(corpo.titulo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
    Object.assign(a, { estado: "NO_MURAL", titulo: String(corpo.titulo).trim(), valorCentavos: (corpo.valorCentavos as number | null) ?? undefined, noMuralAte: dia(30) });
  } else if (m[2] === "recusar") {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    Object.assign(a, { estado: "RECUSADO", motivo: String(corpo.motivo).trim() });
  } else {
    Object.assign(a, { estado: "RETIRADO", motivo: corpo.motivo ? String(corpo.motivo).trim() : undefined });
  }
  a.versao++;
  return route.fulfill({ json: json(a) });
}

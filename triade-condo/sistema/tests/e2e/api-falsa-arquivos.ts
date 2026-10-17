// Parte de fotos e documentos da API falsa da Plataforma (passo 4b). As regras de verdade estão
// testadas no banco (pgTAP 011) e na API (Deno, com a verificação do conteúdo); aqui só o
// bastante para a tela. O "armazenamento" fica no mesmo endereço do app, em /api/v1/armazenamento,
// porque a CSP dos testes não tem o endereço do Supabase.
import type { Route } from "@playwright/test";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

interface ArquivoFalso {
  id: string; parte: string; nome: string; descricao?: string; tipo: string; tamanho: number; situacao: string; motivoRecusa?: string;
  enviadoEm: string; enviadoPor: string; enviadoPorEu: boolean;
}
interface PedidoComArquivos { id: string; estado: string; historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[] }

let n = 0;
const novoId = () => `7a8b9c0d-1e2f-4a3b-8c4d-${String(++n).padStart(12, "0")}`;
const arquivos = new Map<string, ArquivoFalso[]>();
const conteudos = new Map<string, Buffer>();

export function semearArquivos(pedidoId: string, agora: string) {
  const id = novoId();
  arquivos.set(pedidoId, [{ id, parte: "RELATO", nome: "teto-banheiro.jpg", descricao: "Mancha no teto", tipo: "image/png", tamanho: 2_100_000,
    situacao: "LIBERADO", enviadoEm: agora, enviadoPor: "Ana Souza", enviadoPorEu: false }]);
  conteudos.set(id, PNG_1PX);
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

function conferir(b: Buffer, tipo: string): string | null {
  if (tipo === "application/pdf") return b.subarray(0, 5).toString("latin1") === "%PDF-" ? null : "O conteúdo não é um PDF de verdade.";
  if (tipo === "image/png") return b[0] === 0x89 && b.subarray(1, 4).toString() === "PNG" ? null : "O conteúdo não é uma foto PNG de verdade.";
  if (tipo === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 ? null : "O conteúdo não é uma foto JPG de verdade.";
  return "Só fotos (JPG, PNG, WEBP) e PDF.";
}

/** Envio e leitura no "armazenamento". */
export async function rotasArmazenamento(route: Route, caminho: string, metodo: string): Promise<unknown> {
  const r = /^\/v1\/armazenamento\/([^/]+)$/.exec(caminho);
  if (!r) return null;
  if (metodo === "PUT") {
    conteudos.set(r[1]!, route.request().postDataBuffer() ?? Buffer.alloc(0));
    return route.fulfill({ json: { Key: r[1] } });
  }
  const b = conteudos.get(r[1]!);
  const a = [...arquivos.values()].flat().find((x) => x.id === r[1]);
  return b && a ? route.fulfill({ status: 200, body: b, contentType: a.tipo }) : route.fulfill({ status: 404, body: "" });
}

export async function rotasArquivos(route: Route, p: PedidoComArquivos, resto: string, metodo: string, corpo: Record<string, unknown>,
  eu: { nome: string }, agora: string, pode: { enviar: boolean; atualizar: boolean }): Promise<unknown> {
  const lista = arquivos.get(p.id) ?? [];
  arquivos.set(p.id, lista);
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  const hist = (acao: string, dados: Record<string, unknown>) => p.historico.push({ acao, em: agora, autor: eu.nome, dados });

  if (resto === "" && metodo === "GET") {
    return route.fulfill({ json: {
      arquivos: lista.map(({ enviadoPorEu, ...a }) => ({ ...a, podeTirar: enviadoPorEu || pode.atualizar })),
      pode: { enviar: pode.enviar && ativo, enviarConclusao: !ativo && p.estado !== "CANCELADO" && pode.atualizar },
    } });
  }
  if (resto === "" && metodo === "POST") {
    if (!pode.enviar && ativo) return erro(route, 403, "FORBIDDEN");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(corpo.tipo))) {
      return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO" });
    }
    const id = novoId();
    lista.push({ id, parte: String(corpo.parte), nome: String(corpo.nome), descricao: (corpo.descricao as string) ?? undefined, tipo: String(corpo.tipo),
      tamanho: Number(corpo.tamanho), situacao: "ENVIANDO", enviadoEm: agora, enviadoPor: eu.nome, enviadoPorEu: true });
    return route.fulfill({ status: 201, json: { arquivoId: id, envio: { url: `/api/v1/armazenamento/${id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  const r = /^\/([^/]+)\/(verificar|link|tirar)$/.exec(resto);
  const a = r ? lista.find((x) => x.id === r[1]) : undefined;
  if (!r || !a) return erro(route, 404, "NOT_FOUND");
  if (r[2] === "verificar") {
    const motivo = conferir(conteudos.get(a.id) ?? Buffer.alloc(0), a.tipo);
    a.situacao = motivo ? "NAO_LIBERADO" : "LIBERADO";
    if (motivo) {
      a.motivoRecusa = motivo;
      conteudos.delete(a.id);
      hist("pedido.arquivo_recusado", { arquivoNome: a.nome, parte: a.parte, motivo });
      return route.fulfill({ json: { situacao: a.situacao, motivo } });
    }
    hist("pedido.arquivo_enviado", { arquivoNome: a.nome, parte: a.parte });
    return route.fulfill({ json: { situacao: a.situacao } });
  }
  if (r[2] === "link") {
    if (a.situacao !== "LIBERADO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ARQUIVO_NAO_LIBERADO" });
    return route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, tipo: a.tipo, expiraEm: agora } });
  }
  if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
  arquivos.set(p.id, lista.filter((x) => x.id !== a.id));
  hist("pedido.arquivo_tirado", { arquivoNome: a.nome, parte: a.parte, motivo: String(corpo.motivo).trim() });
  return route.fulfill({ json: { ok: true } });
}

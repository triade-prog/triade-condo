// Portaria 1 · Encomendas (PA-01, PA-07, V-04, CF-12) na API falsa: a lista com abas e atalhos,
// registrar com quem fica sabendo, entregar, avisar de novo, avisei por outro meio, a unidade
// vista pela portaria e Configurações › Portaria. As regras de verdade estão no banco (pgTAP
// 042) e na API (Deno, encomendas_test.ts); aqui se confere a tela.
import type { Route } from "@playwright/test";
import { A101, A102 } from "./api-falsa-moradores";

export const A201 = "8b9c0d1e-2f3a-4b4c-9d5e-a00000000201";
const SALA = "5c6d7e8f-9a0b-4c1d-8e2f-000000000001";
const ARMARIO = "5c6d7e8f-9a0b-4c1d-8e2f-000000000002";

const HORA = 3_600_000;
const DIA = 24 * HORA;

type Pessoa = { contatoId: string; nome: string; papel: string; mora: boolean; recebe: boolean; motivo?: "PAROU" | "SEM_WHATSAPP" | "NAO_MORA" };
type Lugar = { id: string; nome: string; ativo: boolean; versao: number };
type Enc = Record<string, unknown> & { id: string; unidadeId: string; estado: "GUARDADA" | "ENTREGUE"; aviso: string; guardadaEm: string; versao: number };

export interface EstadoPortaria {
  unidades: { id: string; rotulo: string; identificacao: string }[];
  pessoas: Record<string, Pessoa[]>;
  lugares: Lugar[];
  encomendas: Enc[];
  config: { lembreteLigado: boolean; lembreteDias: number; sindicoIndicado: boolean; versao: number };
  /** O que a API recebeu, para o teste conferir. */
  recebido: { registros: Record<string, unknown>[]; entregas: Record<string, unknown>[]; outroMeio: Record<string, unknown>[]; config: Record<string, unknown>[] };
}

let n = 0;
const novoId = () => `7e8f9a0b-1c2d-4e3f-9a4b-${String(++n).padStart(12, "0")}`;

export function criarPortaria(): EstadoPortaria {
  const agora = Date.now();
  const em = (ms: number) => new Date(agora - ms).toISOString();
  const pessoas: Record<string, Pessoa[]> = {
    [A101]: [
      { contatoId: "c-marina", nome: "Marina Souza", papel: "Proprietária", mora: true, recebe: true },
      { contatoId: "c-pedro", nome: "Pedro Souza", papel: "Familiar", mora: true, recebe: false, motivo: "PAROU" },
    ],
    [A102]: [{ contatoId: "c-joana", nome: "Joana Lima", papel: "Inquilina", mora: true, recebe: true }],
    [A201]: [{ contatoId: "c-caio", nome: "Caio Reis", papel: "Proprietário", mora: true, recebe: false, motivo: "SEM_WHATSAPP" }],
  };
  const base = { observacao: undefined, moradores: 1, lembreteEm: undefined, fotoEtiqueta: undefined, fotoRetirada: undefined };
  return {
    unidades: [
      { id: A101, rotulo: "Torre A · 101", identificacao: "101" },
      { id: A102, rotulo: "Torre A · 102", identificacao: "102" },
      { id: A201, rotulo: "Torre A · 201", identificacao: "201" },
    ],
    pessoas,
    lugares: [{ id: SALA, nome: "Sala da portaria", ativo: true, versao: 1 }, { id: ARMARIO, nome: "Armário 1", ativo: true, versao: 1 }],
    encomendas: [
      { ...base, id: novoId(), unidadeId: A101, remetente: "Mercado Livre", volumes: 1, lugarId: SALA, estado: "GUARDADA", aviso: "AVISADA",
        avisados: ["Marina Souza"], pararam: ["Pedro Souza"], moradores: 2, guardadaEm: em(2 * HORA), versao: 1 },
      { ...base, id: novoId(), unidadeId: A102, remetente: "Amazon", volumes: 2, lugarId: ARMARIO, estado: "GUARDADA", aviso: "AVISO_FALHOU",
        naoChegou: ["Joana Lima"], guardadaEm: em(2 * DIA), versao: 1 },
      { ...base, id: novoId(), unidadeId: A201, remetente: "Shopee", volumes: 1, lugarId: SALA, estado: "GUARDADA", aviso: "SEM_AVISO", avisoMotivo: "SEM_WHATSAPP",
        semWhatsapp: ["Caio Reis"], guardadaEm: em(9 * DIA), versao: 1 },
      { ...base, id: novoId(), unidadeId: A101, remetente: "Correios", volumes: 1, lugarId: SALA, estado: "ENTREGUE", aviso: "AVISADA",
        avisados: ["Marina Souza"], moradores: 2, guardadaEm: em(3 * DIA), entregueEm: em(2 * DIA + 3 * HORA),
        retirou: { contatoId: "c-marina", nome: "Marina Souza", daUnidade: true }, versao: 2 },
    ],
    config: { lembreteLigado: true, lembreteDias: 7, sindicoIndicado: false, versao: 1 },
    recebido: { registros: [], entregas: [], outroMeio: [], config: [] },
  };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** O resumo do painel (plataforma_painel.portaria). */
export function resumoPortaria(p: EstadoPortaria) {
  const g = p.encomendas.filter((e) => e.estado === "GUARDADA");
  const dias = p.config.lembreteDias;
  return {
    guardadas: g.length,
    semAviso: g.filter((e) => e.aviso === "SEM_AVISO").length,
    avisoFalhou: g.filter((e) => e.aviso === "AVISO_FALHOU").length,
    antigas: g.filter((e) => Date.now() - Date.parse(e.guardadaEm) > dias * DIA).length,
    dias,
  };
}

export async function rotasPortaria(route: Route, p: EstadoPortaria, ctx: { eu: { vinculo: string; nome: string }; condominio: string },
  caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean): Promise<void | null> {
  const ehEncomenda = caminho.startsWith("/v1/condominio/encomendas");
  const ehConfig = caminho.startsWith("/v1/condominio/portaria");
  if (!ehEncomenda && !ehConfig) return null;
  if (ehEncomenda && !pode("portaria.ver")) return erro(route, 403, "FORBIDDEN");
  if (ehConfig && !pode("config.ver")) return erro(route, 403, "FORBIDDEN");
  const eu = { id: ctx.eu.vinculo, nome: ctx.eu.nome, eu: true };
  const dias = p.config.lembreteDias;
  const rotulo = (id: string) => p.unidades.find((u) => u.id === id)?.rotulo ?? "";
  const lugar = (id: unknown) => { const l = p.lugares.find((x) => x.id === id); return l ? { id: l.id, nome: l.nome, ativo: l.ativo } : undefined; };
  const json = (e: Enc) => {
    const d = Math.floor((Date.now() - Date.parse(e.guardadaEm)) / DIA);
    return { ...e, unidade: { id: e.unidadeId, rotulo: rotulo(e.unidadeId) }, lugar: lugar(e.lugarId),
      guardadaPor: (e.guardadaPor as object | undefined) ?? { id: "joao", nome: "João Ribeiro", eu: false },
      entreguePor: e.estado === "ENTREGUE" ? ((e.entreguePor as object | undefined) ?? { id: "joao", nome: "João Ribeiro", eu: false }) : undefined,
      dias: d, antiga: e.estado === "GUARDADA" && d > dias };
  };
  const cuidar = (): void | null => (pode("portaria.cuidar") ? null : erro(route, 403, "FORBIDDEN"));
  const quem = (unidadeId: string) => {
    const pessoas = p.pessoas[unidadeId] ?? [];
    const recebem = pessoas.filter((x) => x.recebe).length;
    return { unidade: { id: unidadeId, rotulo: rotulo(unidadeId) }, pessoas, recebem,
      ...(recebem ? {} : { motivoSemAviso: pessoas.some((x) => x.motivo === "PAROU") ? "PAROU" : pessoas.length ? "SEM_WHATSAPP" : "SEM_CONTATO" }) };
  };

  if (caminho === "/v1/condominio/encomendas" && metodo === "GET") {
    const aba = url.searchParams.get("aba") === "ENTREGUES" ? "ENTREGUE" : "GUARDADA";
    const atalho = url.searchParams.get("atalho");
    const busca = (url.searchParams.get("busca") ?? "").toLowerCase();
    const todas = p.encomendas.map(json);
    const guardadas = todas.filter((e) => e.estado === "GUARDADA");
    let itens = todas.filter((e) => e.estado === aba);
    if (aba === "GUARDADA" && atalho === "ANTIGAS") itens = itens.filter((e) => e.antiga);
    if (aba === "GUARDADA" && atalho === "AVISO_FALHOU") itens = itens.filter((e) => e.aviso === "AVISO_FALHOU");
    if (aba === "GUARDADA" && atalho === "SEM_AVISO") itens = itens.filter((e) => e.aviso === "SEM_AVISO");
    if (busca) itens = itens.filter((e) => e.unidade.rotulo.toLowerCase().includes(busca) || String(e.remetente).toLowerCase().includes(busca));
    itens.sort((a, b) => Date.parse(String(b.entregueEm ?? b.guardadaEm)) - Date.parse(String(a.entregueEm ?? a.guardadaEm)));
    return route.fulfill({ json: {
      itens, total: itens.length, pagina: 1, porPagina: 50, dias, soMinhas: false, pode: { cuidar: pode("portaria.cuidar") },
      contagens: { GUARDADAS: guardadas.length, ENTREGUES: todas.length - guardadas.length, ANTIGAS: guardadas.filter((e) => e.antiga).length,
        AVISO_FALHOU: guardadas.filter((e) => e.aviso === "AVISO_FALHOU").length, SEM_AVISO: guardadas.filter((e) => e.aviso === "SEM_AVISO").length },
    } });
  }
  if (caminho === "/v1/condominio/encomendas/opcoes") {
    return route.fulfill({ json: {
      unidades: p.unidades, lugares: p.lugares.filter((l) => l.ativo).map(({ id, nome }) => ({ id, nome })),
      lembrete: { ligado: p.config.lembreteLigado, dias }, cenario: "PORTARIA_PRESENCIAL", whatsapp: true,
      modelo: { titulo: "Encomenda guardada", situacao: "APROVADO_PILOTO", rodape: "Para não receber estes avisos, responda PARAR.",
        corpo: "Encomenda guardada\n\nHá uma encomenda guardada para {{1}}.\n\nDe: {{2}}\nOnde está: {{3}}\nGuardada desde: {{4}}\nRecebida por: {{5}}\n\nPara retirar, diga seu nome na portaria. Pode retirar quem é da unidade ou alguém que vocês mandarem buscar.\n\nO condomínio nunca pede senha, código ou pagamento por mensagem. Na dúvida, confirme pessoalmente na portaria.\n\nNina, assistente virtual do {{6}}." },
      condominio: ctx.condominio, eu: { id: eu.id, nome: eu.nome }, pode: { cuidar: pode("portaria.cuidar") },
    } });
  }
  const qu = /^\/v1\/condominio\/encomendas\/unidades\/([^/]+)\/quem$/.exec(caminho);
  if (qu) return route.fulfill({ json: quem(qu[1]!) });
  const un = /^\/v1\/condominio\/encomendas\/unidades\/([^/]+)$/.exec(caminho);
  if (un) {
    const da = p.encomendas.filter((e) => e.unidadeId === un[1]).map(json);
    const entregues = da.filter((e) => e.estado === "ENTREGUE");
    return route.fulfill({ json: { unidade: { id: un[1], rotulo: rotulo(un[1]!) }, guardadas: da.filter((e) => e.estado === "GUARDADA"),
      entregues: entregues.slice(0, 3), totalEntregues: entregues.length, pessoas: p.pessoas[un[1]!] ?? [], pode: { cuidar: pode("portaria.cuidar") } } });
  }
  if (caminho === "/v1/condominio/encomendas" && metodo === "POST") {
    const negado = cuidar(); if (negado !== null) return negado;
    p.recebido.registros.push(corpo);
    const unidadeId = String(corpo.unidadeId);
    const q = quem(unidadeId);
    const pessoas = q.pessoas;
    const e: Enc = { id: novoId(), unidadeId, remetente: String(corpo.remetente), volumes: Number(corpo.volumes), lugarId: corpo.lugarId,
      observacao: (corpo.observacao as string) || undefined, estado: "GUARDADA", aviso: q.recebem ? "AVISADA" : "SEM_AVISO",
      avisoMotivo: q.recebem ? undefined : q.motivoSemAviso, avisados: pessoas.filter((x) => x.recebe).map((x) => x.nome),
      pararam: pessoas.filter((x) => x.motivo === "PAROU").map((x) => x.nome), semWhatsapp: pessoas.filter((x) => x.motivo === "SEM_WHATSAPP").map((x) => x.nome),
      moradores: pessoas.filter((x) => x.mora).length, guardadaEm: new Date().toISOString(), guardadaPor: eu, versao: 1 };
    p.encomendas.push(e);
    return route.fulfill({ status: 201, json: { id: e.id, avisos: q.recebem, encomenda: json(e) } });
  }
  const acao = /^\/v1\/condominio\/encomendas\/([^/]+)(?:\/(entregar|avisar|outro-meio))?$/.exec(caminho);
  if (acao) {
    const e = p.encomendas.find((x) => x.id === acao[1]);
    if (!e) return erro(route, 404, "NOT_FOUND");
    const negado = cuidar(); if (negado !== null) return negado;
    if (e.estado === "ENTREGUE") return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENCOMENDA_ENTREGUE" });
    if (acao[2] === "entregar" && metodo === "POST") {
      p.recebido.entregas.push(corpo);
      const pessoa = (p.pessoas[e.unidadeId] ?? []).find((x) => x.contatoId === corpo.contatoId);
      Object.assign(e, { estado: "ENTREGUE", entregueEm: new Date().toISOString(), entreguePor: eu, versao: e.versao + 1,
        retirou: pessoa ? { contatoId: pessoa.contatoId, nome: pessoa.nome, daUnidade: true }
          : { nome: String(corpo.nome), ligacao: (corpo.ligacao as string) || undefined, daUnidade: false } });
      return route.fulfill({ json: { encomenda: json(e) } });
    }
    if (acao[2] === "avisar" && metodo === "POST") {
      const q = quem(e.unidadeId);
      if (!q.recebem) return erro(route, 422, "VALIDATION_ERROR", { motivo: "NINGUEM_RECEBE" });
      Object.assign(e, { aviso: "AVISADA", naoChegou: undefined, avisados: q.pessoas.filter((x) => x.recebe).map((x) => x.nome), versao: e.versao + 1 });
      return route.fulfill({ json: { avisos: q.recebem } });
    }
    if (acao[2] === "outro-meio" && metodo === "POST") {
      p.recebido.outroMeio.push(corpo);
      Object.assign(e, { aviso: "OUTRO_MEIO", outroMeio: { meio: corpo.meio, com: (corpo.com as string) || undefined, em: new Date().toISOString(), por: eu.nome }, versao: e.versao + 1 });
      return route.fulfill({ json: { encomenda: json(e) } });
    }
    if (!acao[2] && metodo === "PUT") {
      if (corpo.versao !== e.versao) return erro(route, 409, "VERSION_CONFLICT");
      Object.assign(e, { unidadeId: corpo.unidadeId, remetente: corpo.remetente, volumes: corpo.volumes, lugarId: corpo.lugarId,
        observacao: (corpo.observacao as string) || undefined, versao: e.versao + 1 });
      return route.fulfill({ json: { encomenda: json(e) } });
    }
  }

  if (caminho === "/v1/condominio/portaria" && metodo === "GET") {
    return route.fulfill({ json: {
      cenario: "PORTARIA_PRESENCIAL", ...p.config,
      lugares: p.lugares.map((l) => ({ ...l, guardadas: p.encomendas.filter((e) => e.estado === "GUARDADA" && e.lugarId === l.id).length })),
      quemCuida: [
        { pessoaId: "p-joao", nome: "João Ribeiro", cargo: "Porteiro", sindico: false, cuida: true },
        { pessoaId: "p-ana", nome: "Ana Souza", cargo: "Síndica", sindico: true, cuida: true },
      ],
      modelo: { titulo: "Encomenda guardada", situacao: "APROVADO_PILOTO" }, pode: { editar: pode("config.editar") },
    } });
  }
  if (caminho === "/v1/condominio/portaria" && metodo === "PUT") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== p.config.versao) return erro(route, 409, "VERSION_CONFLICT");
    p.recebido.config.push(corpo);
    Object.assign(p.config, { lembreteLigado: corpo.lembreteLigado, lembreteDias: corpo.lembreteDias, sindicoIndicado: corpo.sindicoIndicado, versao: p.config.versao + 1 });
    return route.fulfill({ json: { versao: p.config.versao } });
  }
  if (caminho === "/v1/condominio/portaria/lugares" && metodo === "POST") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (p.lugares.some((l) => l.ativo && l.nome.toLowerCase() === String(corpo.nome).trim().toLowerCase())) {
      return erro(route, 422, "VALIDATION_ERROR", { motivo: "LUGAR_REPETIDO" });
    }
    const l = { id: novoId(), nome: String(corpo.nome).trim(), ativo: true, versao: 1 };
    p.lugares.push(l);
    return route.fulfill({ status: 201, json: { id: l.id, versao: 1 } });
  }
  const lu = /^\/v1\/condominio\/portaria\/lugares\/([^/]+)$/.exec(caminho);
  if (lu && metodo === "PUT") {
    const l = p.lugares.find((x) => x.id === lu[1]);
    if (!l) return erro(route, 404, "NOT_FOUND");
    if (corpo.versao !== l.versao) return erro(route, 409, "VERSION_CONFLICT");
    Object.assign(l, { nome: String(corpo.nome).trim(), ativo: corpo.ativo !== false, versao: l.versao + 1 });
    return route.fulfill({ json: { id: l.id, versao: l.versao } });
  }
  return erro(route, 404, "NOT_FOUND");
}

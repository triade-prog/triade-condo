// Renovações no Console falso (0311, R17.7; CM-30, CM-31 e CM-32; quadros 346, 347 e 335), ligado pelo
// api-falsa-console-comercial.ts: quatro clientes como no quadro 346 (o Pequi perto do "avisar até", o
// Ipiranga no fim do fundador, o Águas Claras com o aviso enviado e o aditivo nº 1, o Buriti com o aviso
// atrasado, sinais de risco e o pedido de cancelamento da Ana Ribeiro); a regra do reajuste ainda sem o
// índice do advogado, que só a Administração muda; a sugestão de mudar de faixa e uma expansão aberta.
// O cartão do Início só ganha as renovações quando o teste liga `noInicio` (os testes da 0309 ficam
// como estão). As regras de verdade estão no banco (pgTAP 059 a 061) e na API (Deno).
// R17.7c (0318; quadros 487 a 491): `ligarRetorno` põe na lista um cancelamento confirmado antes do
// último dia (Cerrado Alto), um encerrado (Jatobá), um desfeito e um reativado; as rotas de desfazer,
// gerar o aditivo de retorno, enviar e conferir os PDFs assinados (dos dois aditivos) e reativar; e as
// duas partes de Modelos › Aditivo. A conferência automática lê as mesmas marcas do contrato.
import type { Route } from "@playwright/test";
import { avisarAte, ultimoDiaCancelamento, valeDesde, valorComReajuste } from "../../packages/domain/src/renovacoes.ts";
import type { ComercialConsole, PodeComercial } from "./api-falsa-console-comercial";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
const BIANCA = { id: "2d9e5b20-0000-4000-8000-00000000bb01", nome: "Bianca" };
export const PEQUI = "9c3d4e5f-0000-4000-8000-0000000000c1";
export const IPIRANGA = "9c3d4e5f-0000-4000-8000-0000000000c2";
export const AGUAS = "9c3d4e5f-0000-4000-8000-0000000000c3";
export const BURITI = "9c3d4e5f-0000-4000-8000-0000000000c4";
export const PEDIDO_BURITI = "9c3d4e5f-0000-4000-8000-0000000000d1";
const RENOVACAO_AGUAS = "9c3d4e5f-0000-4000-8000-0000000000e1";
const ARQUIVO_ADITIVO = "9c3d4e5f-0000-4000-8000-0000000000f1";

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).toISOString();
const novoId = (n: number) => `9c3d4e5f-0000-4000-8000-${String(n).padStart(12, "0")}`;
const br = (d: string) => d.split("-").reverse().join("/");

export const K_CERRADO = novoId(901);
export const K_JATOBA = novoId(902);
export const K_IPE = novoId(903);
export const K_AROEIRA = novoId(904);
export const CPF_RETORNO = "529.982.247-25";

type Cliente = { id: string; condominio: string; contato: string; plano: Json; aniversario: string; situacao: string };

export function criarRenovacoes(hoje: string) {
  const prazo = 30;
  const clientes: Cliente[] = [
    { id: PEQUI, condominio: "Residencial Pequi", contato: "Ana", aniversario: somarDias(hoje, 40), situacao: "ATIVO",
      plano: { nome: "Até 40 unidades", valor: 22900, ciclo: "MENSAL", tabela: "CHEIA", unidadesDe: 1, unidadesAte: 40, inicio: "2025-12-05", diaVencimento: 10 } },
    { id: IPIRANGA, condominio: "Edifício Ipiranga", contato: "Rui", aniversario: somarDias(hoje, 70), situacao: "ATIVO",
      plano: { nome: "Até 40 unidades", valor: 12900, ciclo: "MENSAL", tabela: "FUNDADOR", unidadesDe: 1, unidadesAte: 40, inicio: "2025-01-04", diaVencimento: 5 } },
    { id: AGUAS, condominio: "Condomínio Águas Claras", contato: "Paula", aniversario: somarDias(hoje, 25), situacao: "ATIVO",
      plano: { nome: "De 41 a 100 unidades", valor: 34900, ciclo: "MENSAL", tabela: "CHEIA", unidadesDe: 41, unidadesAte: 100, inicio: "2024-11-20", diaVencimento: 10 } },
    { id: BURITI, condominio: "Residencial Buriti", contato: "Ana Ribeiro", aniversario: somarDias(hoje, 28), situacao: "CANCELANDO",
      plano: { nome: "Até 40 unidades", valor: 12900, ciclo: "MENSAL", tabela: "CHEIA", unidadesDe: 1, unidadesAte: 40, inicio: "2025-12-01", diaVencimento: 10 } },
  ];
  const pedidoEm = instante(somarDias(hoje, -2), "11:20");
  return {
    hoje,
    /** O cartão do Início com as renovações e os riscos (o teste da R17.7 liga). */
    noInicio: false,
    seq: 100,
    regra: { prazoAvisoDias: prazo, definida: false, versao: 1 } as Json,
    clientes,
    /** As renovações registradas (aviso enviado ou sem reajuste). */
    registradas: [
      { id: RENOVACAO_AGUAS, versao: 1, interessadoId: AGUAS, aniversario: somarDias(hoje, 25), tipo: "REAJUSTE", situacao: "AVISO_ENVIADO",
        hoje: { valor: 34900, ciclo: "MENSAL", tabela: "CHEIA" }, novo: { valor: 36580, indice: "IPCA", percentual: 4.8 },
        aviso: { em: somarDias(hoje, -5), canal: "WHATSAPP", para: "Paula, síndica" }, valeDesde: valeDesde(somarDias(hoje, 25), somarDias(hoje, -5), prazo, 10),
        registradoEm: instante(somarDias(hoje, -5), "10:00"), registradoPor: CAROLINA,
        aditivo: { id: ARQUIVO_ADITIVO, numero: 1, situacao: "PRONTO", hash: "a3f9c2d17be04c55", geradoEm: instante(somarDias(hoje, -5), "10:00"), envios: [] } },
    ] as Json[],
    sinais: [
      { id: novoId(1), versao: 1, interessadoId: IPIRANGA, tipo: "SINDICO_NOVO", origem: "TROCA_SINDICO", data: somarDias(hoje, -10), criadoEm: instante(somarDias(hoje, -10), "09:00") },
      { id: novoId(2), versao: 1, interessadoId: AGUAS, tipo: "USO_CAINDO", origem: "PEDIDOS", data: somarDias(hoje, -3), detalhe: "Pedidos caíram 60% em 30 dias",
        criadoEm: instante(somarDias(hoje, -3), "03:00") },
    ] as Json[],
    expansoes: [
      { id: novoId(3), versao: 1, interessadoId: AGUAS, nome: "Condomínio Águas Claras II", condominio: "Condomínio Águas Claras", tipo: "MAIS_UM_PREDIO", etapa: "EM_CONVERSA",
        motivo: "A síndica cuida de outro prédio na mesma rua", responsavel: CAROLINA, proximoPasso: "Mostrar o prédio novo no Console", proximoPassoData: somarDias(hoje, 3),
        oportunidade: { id: novoId(4), condominio: "Condomínio Águas Claras II", etapa: "NOVO" }, criadoEm: instante(somarDias(hoje, -7), "15:00") },
    ] as Json[],
    cancelamentos: [
      { id: PEDIDO_BURITI, versao: 1, interessadoId: BURITI, condominio: "Residencial Buriti", plano: { valor: 12900, ciclo: "MENSAL", inicio: "2025-12-01", tabela: "CHEIA" },
        pedidoPor: "Ana Ribeiro, síndica", pedidoEm, avisoDias: 30, ultimoDia: ultimoDiaCancelamento(somarDias(hoje, -2)),
        situacao: "PEDIDO" },
    ] as Json[],
    modelos: [
      { id: novoId(5), versao: 1, numero: 1, tipo: "REAJUSTE", titulo: "Aditivo de reajuste", situacao: "EM_USO",
        texto: "Aditivo ao contrato «contrato» do «condominio». A mensalidade passa de «valor_atual» para «valor_novo» a partir da «vale_desde».",
        emUsoEm: instante("2026-09-01", "10:00"), emUsoPor: CAROLINA, criadoEm: instante("2026-09-01", "09:00"), criadoPor: CAROLINA, aditivos: 1 },
    ] as Json[],
  };
}
export type RenovacoesFalsas = ReturnType<typeof criarRenovacoes>;

/**
 * Os cancelamentos fechados do quadro 491 (R17.7c): o confirmado antes do último dia, o encerrado
 * (com a prévia do plano da volta), o desfeito e o reativado. Com `modeloRetorno`, já há uma versão
 * do aditivo de retorno em uso.
 */
export function ligarRetorno(r: RenovacoesFalsas, o: { modeloRetorno?: boolean } = {}) {
  const hoje = r.hoje;
  const conferido = (parte: string, n: number) => ({ id: novoId(n), versao: 2, parte, situacao: "CONFERIDO", enviadoEm: instante(somarDias(hoje, -7), "10:00"), enviadoPor: CAROLINA,
    conferidoEm: instante(somarDias(hoje, -7), "11:00"), conferidoPor: CAROLINA, nome: `assinado-${parte.toLowerCase()}.pdf` });
  r.cancelamentos.push(
    { id: K_CERRADO, versao: 2, interessadoId: novoId(911), condominio: "Residencial Cerrado Alto", plano: { valor: 22900, ciclo: "MENSAL", inicio: "2025-03-01", tabela: "CHEIA" },
      pedidoPor: "Marta Lima, síndica", pedidoEm: instante(somarDias(hoje, -6), "10:00"), avisoDias: 30, ultimoDia: somarDias(hoje, 24), motivo: "SINDICO_NOVO",
      situacao: "CONFIRMADO", decididoEm: instante(somarDias(hoje, -2), "15:40"), decididoPor: CAROLINA, exportacaoPedida: true },
    { id: K_JATOBA, versao: 3, interessadoId: novoId(912), condominio: "Edifício Jatobá", plano: { valor: 12900, ciclo: "MENSAL", inicio: "2025-01-10", tabela: "FUNDADOR" },
      pedidoPor: "Rui Campos, síndico", pedidoEm: instante(somarDias(hoje, -45), "09:00"), avisoDias: 30, ultimoDia: somarDias(hoje, -15), motivo: "PRECO",
      situacao: "ENCERRADO", decididoEm: instante(somarDias(hoje, -40), "14:00"), decididoPor: CAROLINA, exportacaoPedida: true,
      retornoPlano: { unidades: 38, faixa: "até 40 unidades", valor: 22900, sobConsulta: false } },
    { id: K_IPE, versao: 4, interessadoId: novoId(913), condominio: "Condomínio Ipê Amarelo", plano: { valor: 22900, ciclo: "MENSAL", inicio: "2025-05-01", tabela: "CHEIA" },
      pedidoPor: "Paula Reis, síndica", pedidoEm: instante(somarDias(hoje, -10), "10:00"), avisoDias: 30, ultimoDia: somarDias(hoje, 20), motivo: "POUCO_USO",
      situacao: "DESFEITO", decididoEm: instante(somarDias(hoje, -8), "10:00"), decididoPor: CAROLINA, exportacaoPedida: true,
      desfeitoEm: instante(somarDias(hoje, -1), "09:30"), desfeitoPor: CAROLINA, desfeitoNota: "Paula Reis, síndica, pelo WhatsApp comercial" },
    { id: K_AROEIRA, versao: 6, interessadoId: novoId(914), condominio: "Residencial Aroeira", plano: { valor: 22900, ciclo: "MENSAL", inicio: "2024-08-01", tabela: "CHEIA" },
      pedidoPor: "Ana Souza, síndica", pedidoEm: instante(somarDias(hoje, -95), "10:00"), avisoDias: 30, ultimoDia: somarDias(hoje, -65), motivo: "SINDICO_NOVO",
      situacao: "REATIVADO", decididoEm: instante(somarDias(hoje, -90), "10:00"), decididoPor: CAROLINA, exportacaoPedida: true,
      reativadoEm: instante(somarDias(hoje, -5), "16:00"), reativadoPor: CAROLINA,
      retorno: { id: novoId(921), numero: 2, situacao: "PRONTO", hash: "e5".repeat(32), geradoEm: instante(somarDias(hoje, -9), "10:00"),
        dados: { campos: { vale_desde: `${hoje.slice(5, 7)}/${hoje.slice(0, 4)}` } }, envios: [conferido("CONDOMINIO", 922), conferido("TRIADE", 923)] } },
  );
  if (o.modeloRetorno) {
    r.modelos.push({ id: novoId(6), versao: 1, numero: 1, tipo: "RETORNO", titulo: "Aditivo de retorno ao contrato", situacao: "EM_USO",
      texto: "Aditivo de retorno ao contrato «contrato» do «condominio». A cobrança volta a partir da «vale_desde», pelo plano «plano», por «valor_mensal».",
      emUsoEm: instante("2026-10-30", "10:00"), emUsoPor: CAROLINA, criadoEm: instante("2026-10-30", "09:00"), criadoPor: CAROLINA, aditivos: 1 });
  }
}

/** Um aditivo (de reajuste ou de retorno) pelo id, para as rotas dos envios. */
function acharAditivo(r: RenovacoesFalsas, id: string): Json | undefined {
  for (const g of r.registradas) if ((g.aditivo as Json | undefined)?.id === id) return g.aditivo as Json;
  for (const k of r.cancelamentos) if ((k.retorno as Json | undefined)?.id === id) return k.retorno as Json;
  return undefined;
}
function acharEnvio(r: RenovacoesFalsas, id: string): { a: Json; e: Json } | undefined {
  for (const g of [...r.registradas.map((x) => x.aditivo), ...r.cancelamentos.map((x) => x.retorno)] as (Json | undefined)[]) {
    const e = ((g?.envios ?? []) as Json[]).find((x) => x.id === id);
    if (e) return { a: g!, e };
  }
  return undefined;
}
const conferidoDe = (a: Json, parte: string) => ((a.envios ?? []) as Json[]).some((e) => e.parte === parte && e.situacao === "CONFERIDO");
const TEXTOS_AUTO_ADITIVO: Record<string, string> = {
  ARQUIVO_INVALIDO: "O arquivo não é um PDF que dá para conferir.",
  SEM_ASSINATURA: "O PDF enviado não tem assinatura digital nova. Assine pelo gov.br e envie o arquivo que ele devolver.",
  NAO_E_O_GERADO: "O conteúdo assinado não é o aditivo gerado. Baixe o aditivo, assine sem mudar nada e envie de novo.",
};

function plano(c: Cliente) {
  return c.plano as { valor: number; ciclo: "MENSAL" | "ANUAL"; tabela: string; diaVencimento: number; inicio: string };
}

/** A linha calculada de um cliente (sem registro), como o comercial_renovacoes. */
function calculada(r: RenovacoesFalsas, c: Cliente): Json {
  const prazo = Number(r.regra.prazoAvisoDias);
  const p = plano(c);
  const ate = avisarAte(c.aniversario, prazo);
  const tipo = p.tabela === "FUNDADOR" ? "FIM_FUNDADOR" : "REAJUSTE";
  const novo = tipo === "FIM_FUNDADOR"
    ? { valor: 19900, tabela: "CHEIA" }
    : r.regra.definida
    ? { valor: valorComReajuste(p.valor, Number(r.regra.percentual)), indice: r.regra.indice, percentual: r.regra.percentual, ...(r.regra.referencia ? { referencia: r.regra.referencia } : {}) }
    : undefined;
  return { interessadoId: c.id, condominio: c.condominio, contrato: 1, aniversario: c.aniversario, avisarAte: ate, tipo,
    situacao: ate < r.hoje ? "ATRASADO" : "AVISAR", hoje: { valor: p.valor, ciclo: p.ciclo, tabela: p.tabela }, ...(novo ? { novo } : {}) };
}

function tela(c: ComercialConsole, mes: string, pode: PodeComercial): Json {
  const r = c.renovacoes;
  const prazo = Number(r.regra.prazoAvisoDias);
  const cliente = (id: unknown) => r.clientes.find((x) => x.id === id)!;
  const registradas = r.registradas.map((x) => ({ ...x, condominio: cliente(x.interessadoId).condominio, contrato: 1,
    avisarAte: avisarAte(String(x.aniversario), prazo) }));
  const calculadas = r.clientes
    .filter((x) => x.situacao !== "ENCERRADO" && !r.registradas.some((g) => g.interessadoId === x.id && g.aniversario === x.aniversario))
    .map((x) => calculada(r, x))
    .filter((x) => x.situacao === "ATRASADO" || String(x.aniversario).slice(0, 7) >= mes);
  const renovacoes = [...calculadas.sort((a, b) => Number(a.situacao !== "ATRASADO") - Number(b.situacao !== "ATRASADO") || String(a.aniversario).localeCompare(String(b.aniversario))),
    ...registradas];
  const abertos = r.sinais.filter((s) => !s.tratadoEm);
  const riscos = r.clientes.filter((x) => abertos.some((s) => s.interessadoId === x.id)).map((x) => ({
    interessadoId: x.id, condominio: x.condominio, plano: (x.plano as Json).nome,
    sinais: abertos.filter((s) => s.interessadoId === x.id).map(({ interessadoId: _i, tratadoEm: _t, ...s }) => s),
  }));
  const comFaixa = r.expansoes.some((e) => e.interessadoId === PEQUI && e.tipo === "MUDAR_FAIXA" && !e.encerradaEm);
  const sugestoes = comFaixa ? [] : [{ interessadoId: PEQUI, condominio: "Residencial Pequi", tipo: "MUDAR_FAIXA", motivo: "Passou de 40 unidades ativas" }];
  const emUso = r.modelos.find((m) => m.situacao === "EM_USO");
  return {
    mes, hoje: r.hoje, regra: r.regra, ...(emUso ? { modeloAditivo: { id: emUso.id, numero: emUso.numero, titulo: emUso.titulo } } : {}),
    renovacoes, riscos, expansoes: r.expansoes, sugestoes, cancelamentos: r.cancelamentos,
    clientes: r.clientes.map((x) => ({ id: x.id, condominio: x.condominio, contato: x.contato, plano: x.plano, situacao: x.situacao })),
    equipe: [BIANCA, CAROLINA],
    contagens: { renovacoes: renovacoes.length, riscos: riscos.length, expansoes: r.expansoes.filter((e) => !e.encerradaEm).length + sugestoes.length,
      cancelamentos: r.cancelamentos.filter((k) => k.situacao === "PEDIDO" || k.situacao === "EM_RETENCAO").length },
    avisoCancelamentoDias: 30,
    pode: { editar: pode.editar, regra: !!pode.modelos, confirmar: !!pode.cliente, desfazer: !!pode.cliente, reativar: !!pode.cliente, assinar: !!pode.assinar },
  };
}

/** Os itens dos clientes no cartão do Início (0311): o aniversário perto do "avisar até" e os sinais. */
export function itensInicioRenovacoes(c: ComercialConsole): Json[] {
  const r = c.renovacoes;
  if (!r.noInicio) return [];
  const prazo = Number(r.regra.prazoAvisoDias);
  const itens: Json[] = [];
  for (const x of r.clientes) {
    if (x.situacao === "ENCERRADO") continue;
    const ate = avisarAte(x.aniversario, prazo);
    const registrada = r.registradas.some((g) => g.interessadoId === x.id && g.aniversario === x.aniversario);
    const sinais = r.sinais.filter((s) => s.interessadoId === x.id && !s.tratadoEm);
    const dias = Math.round((Date.parse(`${x.aniversario}T12:00:00Z`) - Date.parse(`${r.hoje}T12:00:00Z`)) / 86_400_000);
    if (!registrada && ate <= somarDias(r.hoje, 15)) {
      itens.push({ id: x.id, condominio: x.condominio, etapa: "GANHO", motivo: "RENOVACAO", meu: false, renovacao: { aniversario: x.aniversario, avisarAte: ate, dias },
        outros: sinais.length });
    } else if (sinais.length) {
      itens.push({ id: x.id, condominio: x.condominio, etapa: "GANHO", motivo: "RISCO", meu: false, risco: { tipo: sinais[0]!.tipo, data: sinais[0]!.data },
        outros: sinais.length - 1 });
    }
  }
  return itens;
}

const ROTAS = /^\/v1\/comercial\/(renovacoes|riscos|cancelamentos|expansoes|modelos\/aditivo|aditivos|envios-aditivo)(\/.*)?$/;

export async function rotasRenovacoes(route: Route, c: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL) {
  const m = ROTAS.exec(caminho);
  if (!m) return null;
  const r = c.renovacoes;
  const raiz = m[1]!;
  const resto = m[2] ?? "";
  const atual = r.hoje.slice(0, 7);
  const conflito = (x: Json) => erro(route, 409, "VERSION_CONFLICT", { versao: x.versao });

  if (raiz === "renovacoes" && resto === "" && metodo === "GET") {
    const mes = url.searchParams.get("mes") ?? atual;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["mes"] });
    return route.fulfill({ json: tela(c, mes, pode) });
  }
  // O PDF do aditivo, servido pelo "armazenamento" do contrato.
  const link = /^\/([0-9a-f-]{36})\/aditivo\/link$/.exec(resto);
  if (raiz === "renovacoes" && link && metodo === "GET") {
    const x = r.registradas.find((g) => g.id === link[1]);
    const a = x?.aditivo as Json | undefined;
    if (!a) return erro(route, 404, "NOT_FOUND");
    if (!c.contrato.arquivos.has(String(a.id))) {
      c.contrato.arquivos.set(String(a.id), { nome: `aditivo-${a.numero}-${String(x!.interessadoId).slice(-2)}.pdf`, conteudo: Buffer.from("%PDF-1.4\n% aditivo falso\n%%EOF\n") });
    }
    return route.fulfill({ json: { url: `/api/v1/arquivos-comercial/${a.id}?baixar=1`, tipo: "application/pdf", expiraEm: new Date(Date.now() + 300_000).toISOString() } });
  }
  // O PDF de um aditivo (o gerado ou o de um envio), servido pelo "armazenamento" do contrato (R17.7c).
  const linkA = /^\/([0-9a-f-]{36})\/link$/.exec(resto);
  if (raiz === "aditivos" && linkA && metodo === "GET") {
    const a = acharAditivo(r, linkA[1]!);
    if (!a) return erro(route, 404, "NOT_FOUND");
    const envio = url.searchParams.get("envio");
    if (envio && !((a.envios ?? []) as Json[]).some((e) => e.id === envio)) return erro(route, 404, "NOT_FOUND");
    const arquivo = envio ?? String(a.id);
    if (!c.contrato.arquivos.has(arquivo)) {
      c.contrato.arquivos.set(arquivo, { nome: `aditivo-${a.numero}.pdf`, conteudo: Buffer.from("%PDF-1.4\n% aditivo falso\n%%EOF\n") });
    }
    return route.fulfill({ json: { url: `/api/v1/arquivos-comercial/${arquivo}?baixar=1`, tipo: "application/pdf", expiraEm: new Date(Date.now() + 300_000).toISOString() } });
  }
  if (raiz === "modelos/aditivo" && resto === "" && metodo === "GET") {
    const emUso = r.modelos.find((x) => x.situacao === "EM_USO" && (x.tipo ?? "REAJUSTE") === "REAJUSTE");
    return route.fulfill({ json: { versoes: [...r.modelos].reverse(), ...(emUso ? { emUso } : {}),
      campos: { REAJUSTE: ["contrato", "condominio", "valor_atual", "valor_novo", "vale_desde"],
        RETORNO: ["condominio", "cnpj", "representante", "cpf_representante", "contrato", "data_contrato", "ultimo_dia", "plano", "valor_mensal", "vale_desde"] },
      regra: r.regra, podeEditar: !!pode.modelos } });
  }
  if (metodo === "GET") return erro(route, 404, "NOT_FOUND");
  if (!pode.editar) return erro(route, 403, "FORBIDDEN");

  if (raiz === "renovacoes" && resto === "/regra" && metodo === "PUT") {
    if (!pode.modelos) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== r.regra.versao) return conflito(r.regra);
    const percentual = corpo.percentual === null || corpo.percentual === undefined ? undefined : Number(corpo.percentual);
    const indice = corpo.indice ? String(corpo.indice) : undefined;
    if ((percentual === undefined) !== (indice === undefined)) return erro(route, 400, "VALIDATION_ERROR", { campos: [percentual === undefined ? "percentual" : "indice"] });
    r.regra = { versao: Number(r.regra.versao) + 1, prazoAvisoDias: Number(corpo.prazoAvisoDias), definida: percentual !== undefined,
      ...(indice ? { indice } : {}), ...(percentual !== undefined ? { percentual } : {}), ...(corpo.referencia ? { referencia: corpo.referencia } : {}),
      alteradoEm: new Date().toISOString(), alteradoPor: CAROLINA };
    return route.fulfill({ json: r.regra });
  }
  if (raiz === "renovacoes" && (resto === "/aviso" || resto === "/dispensar") && metodo === "POST") {
    const x = r.clientes.find((k) => k.id === corpo.interessadoId);
    if (!x || x.aniversario !== corpo.aniversario) return erro(route, 404, "NOT_FOUND");
    const linha = calculada(r, x);
    if (resto === "/dispensar") {
      const nova = { ...linha, id: novoId(r.seq++), versao: 1, situacao: "DISPENSADO", dispensaMotivo: corpo.motivo, novo: undefined, registradoEm: new Date().toISOString(), registradoPor: CAROLINA };
      r.registradas.push(nova);
      return route.fulfill({ status: 201, json: nova });
    }
    if (!linha.novo) return erro(route, 422, "VALIDATION_ERROR", { motivo: "INDICE_A_DEFINIR" });
    const faltam = [...(String(corpo.para ?? "").trim().length < 2 ? ["para"] : []), ...(!corpo.canal ? ["canal"] : []),
      ...(String(corpo.texto ?? "").trim().length < 10 ? ["texto"] : [])];
    if (faltam.length) return erro(route, 400, "VALIDATION_ERROR", { campos: faltam });
    const em = corpo.avisoEm ? String(corpo.avisoEm) : r.hoje;
    const emUso = r.modelos.find((k) => k.situacao === "EM_USO");
    const nova: Json = { ...linha, id: novoId(r.seq++), versao: 1, situacao: "AVISO_ENVIADO", aviso: { em, canal: corpo.canal, para: corpo.para, texto: corpo.texto },
      valeDesde: valeDesde(x.aniversario, em, Number(r.regra.prazoAvisoDias), plano(x).diaVencimento), registradoEm: new Date().toISOString(), registradoPor: CAROLINA,
      ...(emUso ? { aditivo: { id: novoId(r.seq++), numero: Number(emUso.aditivos) + 1, situacao: "PRONTO", hash: "b71e0c94d2a35f68" } } : {}) };
    if (emUso) emUso.aditivos = Number(emUso.aditivos) + 1;
    r.registradas.push(nova);
    return route.fulfill({ status: 201, json: { renovacao: nova } });
  }
  if (raiz === "riscos" && resto === "" && metodo === "POST") {
    const x = r.clientes.find((k) => k.id === corpo.interessadoId);
    if (!x) return erro(route, 404, "NOT_FOUND");
    if (!corpo.tipo || !corpo.data) return erro(route, 400, "VALIDATION_ERROR", { campos: [!corpo.tipo ? "tipo" : "data"] });
    const s = { id: novoId(r.seq++), versao: 1, interessadoId: x.id, tipo: corpo.tipo, origem: "A_MAO", data: corpo.data, ...(corpo.detalhe ? { detalhe: corpo.detalhe } : {}),
      criadoEm: new Date().toISOString() };
    r.sinais.push(s);
    return route.fulfill({ status: 201, json: s });
  }
  const tratar = /^\/([0-9a-f-]{36})\/tratar$/.exec(resto);
  if (raiz === "riscos" && tratar && metodo === "POST") {
    const s = r.sinais.find((k) => k.id === tratar[1]);
    if (!s) return erro(route, 404, "NOT_FOUND");
    if (s.versao !== corpo.versao) return conflito(s);
    Object.assign(s, { tratadoEm: new Date().toISOString(), versao: Number(s.versao) + 1 });
    return route.fulfill({ json: s });
  }
  if (raiz === "cancelamentos" && resto === "" && metodo === "POST") {
    const x = r.clientes.find((k) => k.id === corpo.interessadoId);
    if (!x) return erro(route, 404, "NOT_FOUND");
    if (x.situacao !== "ATIVO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "CANCELAMENTO_ABERTO" });
    if (String(corpo.pedidoPor ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["pedidoPor"] });
    const pedidoEm = corpo.pedidoEm ? String(corpo.pedidoEm) : new Date().toISOString();
    const k = { id: novoId(r.seq++), versao: 1, interessadoId: x.id, condominio: x.condominio, plano: { valor: plano(x).valor, ciclo: plano(x).ciclo, inicio: plano(x).inicio },
      pedidoPor: corpo.pedidoPor, pedidoEm, avisoDias: 30, ultimoDia: ultimoDiaCancelamento(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(pedidoEm))),
      situacao: "PEDIDO" };
    r.cancelamentos.unshift(k);
    x.situacao = "CANCELANDO";
    return route.fulfill({ status: 201, json: k });
  }
  const acao = /^\/([0-9a-f-]{36})\/(retencao|ficou|confirmar)$/.exec(resto);
  if (raiz === "cancelamentos" && acao && metodo === "POST") {
    const k = r.cancelamentos.find((x) => x.id === acao[1]);
    if (!k) return erro(route, 404, "NOT_FOUND");
    if (k.situacao !== "PEDIDO" && k.situacao !== "EM_RETENCAO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "CANCELAMENTO_FECHADO" });
    if (acao[2] === "confirmar" && !pode.cliente) return erro(route, 403, "FORBIDDEN");
    if (k.versao !== corpo.versao) return conflito(k);
    const x = r.clientes.find((g) => g.id === k.interessadoId)!;
    if (acao[2] !== "ficou" && !corpo.motivo) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (acao[2] === "retencao") {
      Object.assign(k, { motivo: corpo.motivo, ...(corpo.motivoTexto ? { motivoTexto: corpo.motivoTexto } : {}), retencao: corpo.retencao, retencaoEm: new Date().toISOString(),
        retencaoPor: CAROLINA, situacao: "EM_RETENCAO" });
    } else if (acao[2] === "ficou") {
      Object.assign(k, { situacao: "FICOU", decididoEm: new Date().toISOString(), decididoPor: CAROLINA });
      x.situacao = "ATIVO";
    } else {
      Object.assign(k, { motivo: corpo.motivo, situacao: "CONFIRMADO", decididoEm: new Date().toISOString(), decididoPor: CAROLINA, exportacaoPedida: true,
        ...(corpo.lembrarEm ? { lembrarEm: corpo.lembrarEm } : {}) });
    }
    k.versao = Number(k.versao) + 1;
    return route.fulfill({ json: { ...k, ...(acao[2] === "confirmar" ? { semSindico: false } : {}) } });
  }
  // Desfazer antes do último dia (quadro 487): só a Administração, com a nota.
  const fechado = /^\/([0-9a-f-]{36})\/(desfazer|reativar|retorno\/aditivo)$/.exec(resto);
  if (raiz === "cancelamentos" && fechado && metodo === "POST") {
    const k = r.cancelamentos.find((x) => x.id === fechado[1]);
    if (!k) return erro(route, 404, "NOT_FOUND");
    if (!pode.cliente) return erro(route, 403, "FORBIDDEN");
    if (fechado[2] === "desfazer") {
      if (k.situacao !== "CONFIRMADO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "CANCELAMENTO_FECHADO" });
      if (String(k.ultimoDia) < r.hoje) return erro(route, 422, "VALIDATION_ERROR", { motivo: "ULTIMO_DIA_PASSOU" });
      if (k.versao !== corpo.versao) return conflito(k);
      const nota = String(corpo.nota ?? "").trim();
      if (nota.length < 3 || nota.length > 300) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nota"] });
      Object.assign(k, { situacao: "DESFEITO", desfeitoEm: new Date().toISOString(), desfeitoPor: CAROLINA, desfeitoNota: nota, versao: Number(k.versao) + 1 });
      const x = r.clientes.find((g) => g.id === k.interessadoId);
      if (x) x.situacao = "ATIVO";
      return route.fulfill({ json: { cancelamento: k } });
    }
    if (k.situacao !== "ENCERRADO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "CANCELAMENTO_NAO_ENCERRADO" });
    const atualRet = k.retorno as Json | undefined;
    if (fechado[2] === "reativar") {
      if (k.versao !== corpo.versao) return conflito(k);
      if (!atualRet || !conferidoDe(atualRet, "CONDOMINIO") || !conferidoDe(atualRet, "TRIADE")) return erro(route, 422, "VALIDATION_ERROR", { motivo: "ADITIVO_SEM_ASSINATURAS" });
      Object.assign(k, { situacao: "REATIVADO", reativadoEm: new Date().toISOString(), reativadoPor: CAROLINA, versao: Number(k.versao) + 1 });
      return route.fulfill({ json: { cancelamento: k } });
    }
    const modelo = r.modelos.find((x) => x.situacao === "EM_USO" && x.tipo === "RETORNO");
    if (!modelo) return erro(route, 422, "VALIDATION_ERROR", { motivo: "SEM_MODELO_RETORNO" });
    const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
    const comp = String(corpo.competencia ?? "");
    const faltam = [...(String(corpo.representante ?? "").trim().length < 3 ? ["representante"] : []), ...(cpf.length !== 11 ? ["cpf"] : []),
      ...(!/^\d{4}-\d{2}-01$/.test(comp) ? ["competencia"] : []), ...(!["MENSAL", "ANUAL"].includes(String(corpo.ciclo)) ? ["ciclo"] : []),
      ...(atualRet && String(corpo.motivo ?? "").trim().length < 3 ? ["motivo"] : [])];
    if (faltam.length) return erro(route, 400, "VALIDATION_ERROR", { campos: faltam });
    const plano = (k.retornoPlano ?? {}) as Json;
    const anual = corpo.ciclo === "ANUAL";
    const a: Json = { id: novoId(r.seq++), numero: atualRet ? Number(atualRet.numero) + 1 : 2, situacao: "PRONTO", hash: `${(r.seq % 10)}f`.repeat(32),
      geradoEm: new Date().toISOString(), envios: [],
      dados: { campos: { condominio: k.condominio, cnpj: "12.345.678/0001-90", representante: String(corpo.representante).trim(),
        cpf_representante: `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`, contrato: "1", data_contrato: br(String((k.plano as Json).inicio)), ultimo_dia: br(String(k.ultimoDia)),
        plano: `Até 40 unidades, ${anual ? "anual" : "mensal"}`, valor_mensal: `R$ ${(Number(plano.valor ?? 22900) / 100).toFixed(2).replace(".", ",")} por mês`,
        vale_desde: `${comp.slice(5, 7)}/${comp.slice(0, 4)}` } } };
    k.retorno = a;
    modelo.aditivos = Number(modelo.aditivos) + 1;
    return route.fulfill({ status: 201, json: { aditivo: a } });
  }
  // Os PDFs assinados dos aditivos (R17.7b e R17.7c): a equipe envia o do condomínio e o da TRÍADE.
  const envios = /^\/([0-9a-f-]{36})\/envios$/.exec(resto);
  if (raiz === "aditivos" && envios && metodo === "POST") {
    const a = acharAditivo(r, envios[1]!);
    if (!a) return erro(route, 404, "NOT_FOUND");
    const parte = String(corpo.parte);
    if (parte === "TRIADE" && !pode.assinar) return erro(route, 403, "FORBIDDEN");
    if (a.situacao !== "PRONTO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "ADITIVO_SUBSTITUIDO" });
    if (conferidoDe(a, parte)) return erro(route, 422, "VALIDATION_ERROR", { motivo: "PARTE_JA_CONFERIDA" });
    if (parte === "TRIADE" && !conferidoDe(a, "CONDOMINIO")) return erro(route, 422, "VALIDATION_ERROR", { motivo: "ORDEM_DAS_ASSINATURAS" });
    if (!(Number(corpo.tamanho) >= 1 && Number(corpo.tamanho) <= 10 * 1024 * 1024)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["tamanho"] });
    const id = novoId(r.seq++);
    (a.envios as Json[]).push({ id, versao: 1, parte, situacao: "ENVIANDO", enviadoEm: new Date().toISOString(), enviadoPor: CAROLINA, nome: corpo.nome });
    c.contrato.arquivos.set(id, { nome: String(corpo.nome), conteudo: Buffer.alloc(0) });
    return route.fulfill({ status: 201, json: { envioId: id, envio: { url: `/api/v1/arquivos-comercial/${id}`, metodo: "PUT", tipo: "application/pdf" } } });
  }
  const ea = /^\/([0-9a-f-]{36})\/(verificar|conferir|recusar)$/.exec(resto);
  if (raiz === "envios-aditivo" && ea && metodo === "POST") {
    const achado = acharEnvio(r, ea[1]!);
    if (!achado) return erro(route, 404, "NOT_FOUND");
    const { a, e } = achado;
    const lista = a.envios as Json[];
    if (ea[2] === "verificar") {
      if (e.situacao !== "ENVIANDO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_CONFERIDO" });
      const t = (c.contrato.arquivos.get(String(e.id))?.conteudo ?? Buffer.alloc(0)).toString("latin1");
      const motivo = !t.startsWith("%PDF-") || t.includes("NAO-E-PDF") ? "ARQUIVO_INVALIDO" : t.includes("SEM-ASSINATURA") ? "SEM_ASSINATURA" : t.includes("OUTRO-ARQUIVO") ? "NAO_E_O_GERADO" : null;
      const em = new Date().toISOString();
      if (!motivo) {
        for (const x of lista) if (x.parte === e.parte && ["A_CONFERIR", "NAO_E_O_GERADO"].includes(String(x.situacao))) x.situacao = "SUBSTITUIDO";
        Object.assign(e, { situacao: "A_CONFERIR", automatica: { temAssinatura: true, assinaturas: e.parte === "TRIADE" ? 2 : 1, eOGerado: true, em } });
      } else {
        Object.assign(e, { situacao: motivo === "NAO_E_O_GERADO" ? "NAO_E_O_GERADO" : "RECUSADO_NA_HORA", motivo, motivoTexto: TEXTOS_AUTO_ADITIVO[motivo],
          automatica: motivo === "ARQUIVO_INVALIDO" ? undefined : { temAssinatura: motivo !== "SEM_ASSINATURA", assinaturas: motivo === "SEM_ASSINATURA" ? 0 : 1, eOGerado: false, em } });
      }
      return route.fulfill({ json: e });
    }
    if (corpo.versao !== e.versao) return conflito(e);
    if (ea[2] === "recusar") {
      if (!["A_CONFERIR", "NAO_E_O_GERADO"].includes(String(e.situacao))) return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_NAO_CONFERIVEL" });
      const motivo = String(corpo.motivo ?? "").trim();
      if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(e, { situacao: "RECUSADO", motivo: "RECUSADO_NA_CONFERENCIA", motivoTexto: motivo, recusa: { motivo, por: CAROLINA, em: new Date().toISOString() }, versao: Number(e.versao) + 1 });
      return route.fulfill({ json: e });
    }
    if (e.situacao !== "A_CONFERIR") return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_NAO_CONFERIVEL" });
    if (e.parte === "TRIADE" && !pode.assinar) return erro(route, 403, "FORBIDDEN");
    const falta = ["assinaturaValida", "pessoaConfere", "dataConfere"].filter((x) => corpo[x] !== true);
    if (falta.length) return erro(route, 400, "VALIDATION_ERROR", { campos: falta });
    const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
    const doRepresentante = String(((a.dados as Json | undefined)?.campos as Json | undefined)?.cpf_representante ?? "");
    if (e.parte === "CONDOMINIO" && cpf && doRepresentante && !doRepresentante.includes(`${cpf.slice(3, 6)}.${cpf.slice(6, 9)}`)) {
      return erro(route, 422, "VALIDATION_ERROR", { motivo: "CPF_NAO_CONFERE" });
    }
    if (e.parte === "TRIADE" && cpf.length !== 11) return erro(route, 400, "VALIDATION_ERROR", { campos: ["cpf"] });
    const em = new Date().toISOString();
    Object.assign(e, { situacao: "CONFERIDO", conferidoEm: em, conferidoPor: CAROLINA, versao: Number(e.versao) + 1,
      conferencia: { assinanteNome: corpo.assinanteNome ?? undefined, cpfMascarado: cpf ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : undefined,
        observacao: corpo.observacao ?? undefined, por: CAROLINA, em } });
    return route.fulfill({ json: e });
  }
  if (raiz === "expansoes" && resto === "" && metodo === "POST") {
    const x = r.clientes.find((k) => k.id === corpo.interessadoId);
    if (!x) return erro(route, 404, "NOT_FOUND");
    const op = corpo.oportunidade as Json | null;
    const responsavel = [BIANCA, CAROLINA].find((p) => p.id === corpo.responsavelId) ?? CAROLINA;
    const e = { id: novoId(r.seq++), versao: 1, interessadoId: x.id, nome: op ? String(op.condominio) : x.condominio, condominio: x.condominio, tipo: corpo.tipo,
      etapa: corpo.etapa ?? "ABERTA", motivo: corpo.motivo, responsavel, ...(corpo.proximoPasso ? { proximoPasso: corpo.proximoPasso } : {}),
      ...(corpo.proximoPassoData ? { proximoPassoData: corpo.proximoPassoData } : {}),
      ...(op ? { oportunidade: { id: novoId(r.seq++), condominio: op.condominio, etapa: "NOVO" } } : {}), criadoEm: new Date().toISOString() };
    r.expansoes.unshift(e);
    return route.fulfill({ status: 201, json: e });
  }
  const exp = /^\/([0-9a-f-]{36})(\/encerrar)?$/.exec(resto);
  if (raiz === "expansoes" && exp) {
    const e = r.expansoes.find((x) => x.id === exp[1]);
    if (!e) return erro(route, 404, "NOT_FOUND");
    if (e.versao !== corpo.versao) return conflito(e);
    if (exp[2]) Object.assign(e, { etapa: corpo.etapa, ...(corpo.resultado ? { resultado: corpo.resultado } : {}), encerradaEm: new Date().toISOString() });
    else {
      const { versao: _v, ...resto2 } = corpo;
      const responsavel = [BIANCA, CAROLINA].find((p) => p.id === corpo.responsavelId) ?? e.responsavel;
      Object.assign(e, resto2, { responsavel });
    }
    e.versao = Number(e.versao) + 1;
    return route.fulfill({ json: e });
  }
  if (raiz === "modelos/aditivo") {
    if (!pode.modelos) return erro(route, 403, "FORBIDDEN");
    const usar = /^\/([0-9a-f-]{36})\/usar$/.exec(resto);
    if (usar && metodo === "POST") {
      const novo = r.modelos.find((x) => x.id === usar[1]);
      if (!novo) return erro(route, 404, "NOT_FOUND");
      if (novo.versao !== corpo.versao) return conflito(novo);
      const tipo = novo.tipo ?? "REAJUSTE";
      for (const x of r.modelos) {
        if (x.situacao === "EM_USO" && (x.tipo ?? "REAJUSTE") === tipo) Object.assign(x, { situacao: "SUBSTITUIDA", substituidaEm: new Date().toISOString(), versao: Number(x.versao) + 1 });
      }
      Object.assign(novo, { situacao: "EM_USO", emUsoEm: new Date().toISOString(), emUsoPor: CAROLINA, versao: Number(novo.versao) + 1 });
      return route.fulfill({ json: novo });
    }
    const um = /^\/([0-9a-f-]{36})$/.exec(resto);
    if ((resto === "" && metodo === "POST") || (um && metodo === "PUT")) {
      const existe = um ? r.modelos.find((x) => x.id === um[1]) : undefined;
      if (um && (!existe || existe.situacao !== "RASCUNHO")) return erro(route, 422, "VALIDATION_ERROR", { motivo: "MODELO_EM_USO" });
      if (existe && existe.versao !== corpo.versao) return conflito(existe);
      if (existe) {
        Object.assign(existe, { titulo: corpo.titulo, texto: corpo.texto, versao: Number(existe.versao) + 1 });
        return route.fulfill({ json: existe });
      }
      const tipo = corpo.tipo === "RETORNO" ? "RETORNO" : "REAJUSTE";
      if (String(corpo.texto ?? "").trim().length < 50) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
      const novo = { id: novoId(r.seq++), versao: 1, numero: r.modelos.filter((x) => (x.tipo ?? "REAJUSTE") === tipo).length + 1, tipo, titulo: corpo.titulo, texto: corpo.texto, situacao: "RASCUNHO",
        criadoEm: new Date().toISOString(), criadoPor: CAROLINA, aditivos: 0 };
      r.modelos.push(novo);
      return route.fulfill({ status: 201, json: novo });
    }
  }
  return erro(route, 404, "NOT_FOUND");
}

// Tabela de preços do Console falsa (0295): as faixas com fundador, cheia e implantação, os
// parâmetros, as vagas de fundador, os preços dos concorrentes cadastrados à mão, o histórico só de
// inserção e a sugestão do plano, que não grava nada. As regras de verdade estão no banco (pgTAP 041)
// e na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";

type Json = Record<string, unknown>;

const NOMES: Record<string, string> = { ATE_40: "Até 40 unidades", DE_41_A_100: "41 a 100 unidades", DE_101_A_200: "101 a 200 unidades", DE_201_A_400: "201 a 400 unidades" };

export function criarPrecosConsole() {
  const faixa = (codigo: string, ordem: number, de: number, ate: number | undefined, fundador?: number, cheia?: number, implantacao?: number) => ({
    codigo, nome: NOMES[codigo] ?? "Acima de 400 unidades", ordem, unidadesDe: de, unidadesAte: ate, sobConsulta: ate === undefined,
    fundador, cheia, implantacao, anual: cheia === undefined ? undefined : cheia * 11, moeda: "BRL", versao: 1,
  } as Json);
  const concorrente = (id: string, nome: string, modelo: string, extra: Json) => ({
    id, nome, modelo, aPartirDe: false, conferido: true, moeda: "BRL", fonte: "site oficial", lidoEm: "2026-10-24", arquivado: false, versao: 1, ...extra,
  } as Json);
  const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
  return {
    faixas: [
      faixa("ATE_40", 1, 1, 40, 12900, 19900, 60000),
      faixa("DE_41_A_100", 2, 41, 100, 22900, 34900, 90000),
      faixa("DE_101_A_200", 3, 101, 200, 34900, 54900, 140000),
      faixa("DE_201_A_400", 4, 201, 400, 54900, 84900, 200000),
      faixa("ACIMA_DE_400", 5, 401, undefined),
    ],
    parametros: { mesesPagosAnual: 11, parcelasImplantacao: 3, vagasFundador: 5, tabelaEmUso: "FUNDADOR", versao: 1 } as Json,
    vagasUsadas: 2,
    /** Unidades ativas do cliente, para a sugestão. */
    unidadesAtivas: 42,
    /** Este cliente já ocupa uma vaga de fundador. */
    ocupaVaga: false,
    concorrentes: [
      concorrente("c1a2b3c4-0000-4000-8000-000000000001", "iSindi", "FIXO", { valor: 2490 }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000002", "Seu Síndico IA", "FIXO", { valor: 9999 }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000003", "MeuVizy", "FIXO", { valor: 14900, aPartirDe: true }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000004", "SindIA", "FAIXA", { faixas: [{ ate: 50, valor: 19700 }, { ate: 150, valor: 39700 }] }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000005", "Meu Condomínio Pro (terceiros)", "FAIXA", { faixas: [{ ate: 80, valor: 34900 }], conferido: false, fonte: "blog de terceiros" }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000006", "HabitaOne Essencial", "POR_UNIDADE", { porUnidade: 490, minimo: 14900 }),
      concorrente("c1a2b3c4-0000-4000-8000-000000000007", "HabitaOne Profissional", "POR_UNIDADE", { porUnidade: 790, minimo: 29900 }),
    ],
    historico: [
      { id: "2", em: "2026-10-24T03:12:00Z", entidade: "CONCORRENTE", entidadeId: "c1a2b3c4-0000-4000-8000-000000000001", acao: "CRIADO",
        depois: { nome: "iSindi", fonte: "site oficial", lidoEm: "2026-10-24" }, motivo: "Conferência web de 24/10", autor: CAROLINA },
      { id: "1", em: "2026-10-24T03:10:00Z", entidade: "PARAMETROS", entidadeId: "1", acao: "ALTERADA",
        depois: { mesesPagosAnual: 11, parcelasImplantacao: 3, vagasFundador: 5, tabelaEmUso: "FUNDADOR" }, motivo: "Decisão de preço D2", autor: CAROLINA },
    ] as Json[],
    autor: CAROLINA,
    /** As sugestões pedidas (ciclo e início), para o teste conferir. */
    sugestoes: [] as string[],
  };
}

export type PrecosConsole = ReturnType<typeof criarPrecosConsole>;

function erro(route: Route, status: number, codigo: string, detalhes?: Json) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const motivoCurto = (corpo: Json) => String(corpo.motivo ?? "").trim().length < 3;
const valorRuim = (v: unknown) => v !== null && v !== undefined && (typeof v !== "number" || !Number.isInteger(v) || v <= 0);
const centavosOuNada = (v: unknown) => (typeof v === "number" ? v : undefined);

function anotar(p: PrecosConsole, e: { entidade: string; entidadeId: string; acao: string; antes?: Json; depois: Json }, motivo: unknown) {
  p.historico.unshift({ id: String(p.historico.length + 1), em: new Date().toISOString(), ...e, motivo: String(motivo), autor: p.autor });
}

/** Soma meses a uma competência "aaaa-mm-01". */
function somarMeses(inicio: string, meses: number): string {
  const [a, m] = inicio.split("-").map(Number) as [number, number];
  const t = a * 12 + (m - 1) + meses;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

/** A sugestão do plano pela tabela: não grava nada. */
function sugestao(p: PrecosConsole, ciclo: string, inicio: string) {
  const n = p.unidadesAtivas;
  const total = Number(p.parametros.vagasFundador);
  const livres = Math.max(total - p.vagasUsadas, 0);
  const tabelaEmUso = p.parametros.tabelaEmUso;
  const vagasFundador = { total, ocupadas: p.vagasUsadas, livres, esteClienteOcupa: p.ocupaVaga, ...(tabelaEmUso === "FUNDADOR" && (livres > 0 || p.ocupaVaga) ? { posicao: p.vagasUsadas + (p.ocupaVaga ? 0 : 1) } : {}) };
  if (n <= 0) return { unidades: 0, ciclo, tabelaEmUso, vagasFundador, avisos: ["SEM_UNIDADES"] };
  const f = p.faixas.find((x) => n >= Number(x.unidadesDe) && (x.unidadesAte === undefined || n <= Number(x.unidadesAte)))!;
  const faixa = { codigo: f.codigo, nome: f.nome, unidadesDe: f.unidadesDe, unidadesAte: f.unidadesAte, sobConsulta: f.sobConsulta };
  const base = { unidades: n, ciclo, tabelaEmUso, vagasFundador, faixa, conjuntos: ["AGENDA", "MANUTENCAO", "VIDA", "COMUNICACAO_AMPLIADA"] };
  const plano = { unidadesDe: f.unidadesDe, unidadesAte: f.unidadesAte, ciclo, diaVencimento: 10, inicioCompetencia: inicio };
  if (f.sobConsulta) {
    return { ...base, plano: { ...plano, nome: "Sob consulta", tabela: "MANUAL", implantacaoSemCobranca: false }, avisos: ["SOB_CONSULTA"] };
  }
  const avisos: string[] = [];
  const querFundador = tabelaEmUso === "FUNDADOR";
  if (querFundador && ciclo === "ANUAL") avisos.push("FUNDADOR_SO_MENSAL");
  else if (querFundador && livres <= 0 && !p.ocupaVaga) avisos.push("SEM_VAGA_FUNDADOR");
  if (querFundador && !avisos.length) {
    return { ...base, avisos, plano: { ...plano, nome: "Fundador", tabela: "FUNDADOR", valor: f.fundador, implantacaoSemCobranca: true, fundadorAte: somarMeses(inicio, 11) } };
  }
  const anual = ciclo === "ANUAL";
  const mes = centavosOuNada(f.cheia);
  return { ...base, avisos, plano: { ...plano, nome: "Tabela cheia", tabela: "CHEIA", valor: mes === undefined ? undefined : anual ? mes * Number(p.parametros.mesesPagosAnual) : mes,
    valorMensal: mes, ...(anual ? { mesesPagos: p.parametros.mesesPagosAnual } : {}),
    implantacaoValor: anual ? undefined : f.implantacao, implantacaoSemCobranca: anual, ...(anual ? {} : { implantacaoParcelas: p.parametros.parcelasImplantacao }) } };
}

/** As rotas da Tabela de preços e da sugestão do plano; null quando não é daqui. */
export async function rotasPrecosConsole(route: Route, p: PrecosConsole, caminho: string, metodo: string, corpo: Json, url: URL,
  pode: { ver: boolean; editar: boolean }) {
  const sug = /^\/v1\/clientes\/[0-9a-f-]{36}\/plano\/sugestao$/.exec(caminho);
  if (sug) {
    if (!pode.ver) return erro(route, 403, "FORBIDDEN");
    const ciclo = url.searchParams.get("ciclo") === "ANUAL" ? "ANUAL" : "MENSAL";
    const inicio = url.searchParams.get("inicio") ?? "2026-11-01";
    p.sugestoes.push(`${ciclo} ${inicio}`);
    return route.fulfill({ json: sugestao(p, ciclo, inicio) });
  }
  if (!caminho.startsWith("/v1/precos")) return null;
  if (!pode.ver) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/precos" && metodo === "GET") {
    const total = Number(p.parametros.vagasFundador);
    return route.fulfill({ json: {
      faixas: p.faixas, parametros: p.parametros, vagasFundador: { total, ocupadas: p.vagasUsadas, livres: Math.max(total - p.vagasUsadas, 0) },
      concorrentes: [...p.concorrentes.filter((c) => !c.arquivado), ...p.concorrentes.filter((c) => c.arquivado)], podeEditar: pode.editar,
    } });
  }
  if (caminho === "/v1/precos/historico") {
    const limite = Math.max(1, Number(url.searchParams.get("limite") ?? 50));
    const antes = url.searchParams.get("antes");
    const desde = antes ? p.historico.findIndex((e) => e.id === antes) + 1 : 0;
    return route.fulfill({ json: { eventos: p.historico.slice(desde, desde + limite) } });
  }
  if (metodo === "GET") return erro(route, 404, "NOT_FOUND");
  if (!pode.editar) return erro(route, 403, "FORBIDDEN");
  if (motivoCurto(corpo)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });

  const fx = /^\/v1\/precos\/faixas\/([A-Z0-9_]+)$/.exec(caminho);
  if (fx && metodo === "PUT") {
    const f = p.faixas.find((x) => x.codigo === fx[1]);
    if (!f) return erro(route, 404, "NOT_FOUND");
    if (f.sobConsulta) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FAIXA_SOB_CONSULTA" });
    if (corpo.versao !== f.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: f.versao });
    const campos = ["fundador", "cheia", "implantacao"].filter((k) => valorRuim(corpo[k]));
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const antes = { fundador: f.fundador, cheia: f.cheia, implantacao: f.implantacao };
    Object.assign(f, { fundador: centavosOuNada(corpo.fundador), cheia: centavosOuNada(corpo.cheia), implantacao: centavosOuNada(corpo.implantacao), versao: Number(f.versao) + 1 });
    f.anual = typeof f.cheia === "number" ? f.cheia * Number(p.parametros.mesesPagosAnual) : undefined;
    anotar(p, { entidade: "FAIXA", entidadeId: String(f.codigo), acao: "ALTERADA", antes, depois: { fundador: f.fundador, cheia: f.cheia, implantacao: f.implantacao } }, corpo.motivo);
    return route.fulfill({ json: f });
  }
  if (caminho === "/v1/precos/parametros" && metodo === "PUT") {
    if (corpo.versao !== p.parametros.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: p.parametros.versao });
    if (Number(corpo.vagasFundador) < p.vagasUsadas) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VAGAS_OCUPADAS" });
    const { mesesPagosAnual, parcelasImplantacao, vagasFundador, tabelaEmUso } = p.parametros;
    const antes = { mesesPagosAnual, parcelasImplantacao, vagasFundador, tabelaEmUso };
    Object.assign(p.parametros, { mesesPagosAnual: corpo.mesesPagosAnual, parcelasImplantacao: corpo.parcelasImplantacao, vagasFundador: corpo.vagasFundador,
      tabelaEmUso: corpo.tabelaEmUso, versao: Number(p.parametros.versao) + 1 });
    anotar(p, { entidade: "PARAMETROS", entidadeId: "1", acao: "ALTERADA", antes, depois: { mesesPagosAnual: corpo.mesesPagosAnual, parcelasImplantacao: corpo.parcelasImplantacao,
      vagasFundador: corpo.vagasFundador, tabelaEmUso: corpo.tabelaEmUso } }, corpo.motivo);
    return route.fulfill({ json: p.parametros });
  }
  if (caminho === "/v1/precos/concorrentes" && metodo === "POST") {
    if (String(corpo.nome ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    if (String(corpo.fonte ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["fonte"] });
    if (corpo.modelo === "FIXO" && typeof corpo.valor !== "number") return erro(route, 400, "VALIDATION_ERROR", { campos: ["valor"] });
    const { motivo, ...resto } = corpo;
    const c: Json = { aPartirDe: false, conferido: true, ...resto, id: crypto.randomUUID(), moeda: "BRL", arquivado: false, versao: 1 };
    p.concorrentes.push(c);
    anotar(p, { entidade: "CONCORRENTE", entidadeId: String(c.id), acao: "CRIADO", depois: c }, motivo);
    return route.fulfill({ status: 201, json: c });
  }
  const cc = /^\/v1\/precos\/concorrentes\/([0-9a-f-]{36})(\/arquivar)?$/.exec(caminho);
  if (cc) {
    const c = p.concorrentes.find((x) => x.id === cc[1]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (c.arquivado) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONCORRENTE_ARQUIVADO" });
    if (corpo.versao !== c.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: c.versao });
    const { motivo, ...resto } = corpo;
    const antes = { ...c };
    if (cc[2]) Object.assign(c, { arquivado: true, arquivadoEm: new Date().toISOString(), arquivadoMotivo: motivo, versao: Number(c.versao) + 1 });
    else Object.assign(c, { ...resto, versao: Number(c.versao) + 1 });
    anotar(p, { entidade: "CONCORRENTE", entidadeId: String(c.id), acao: cc[2] ? "ARQUIVADO" : "ALTERADO", antes, depois: { ...c } }, motivo);
    return route.fulfill({ json: c });
  }
  return erro(route, 404, "NOT_FOUND");
}

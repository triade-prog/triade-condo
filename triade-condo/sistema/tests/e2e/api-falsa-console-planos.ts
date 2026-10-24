// Planos e pagamentos do Console falsos (0291): conjuntos contratados e liberados, o plano, as
// cobranças por competência, os recebimentos a conferir e os sem cliente. As regras de verdade estão
// no banco (pgTAP 038) e na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";

type Json = Record<string, unknown>;

const TELAS: Record<string, { nome: string; base: boolean; resumo: string; telas: string[] }> = {
  ATENDIMENTO: { nome: "Atendimento", base: true, resumo: "Pedidos, comunicados, moradores e o mural.", telas: ["Pedidos", "Comunicados", "Moradores"] },
  AGENDA: { nome: "Agenda", base: false, resumo: "Prazos, vencimentos e feriados num só lugar.", telas: ["Agenda", "Prazos e vencimentos"] },
  MANUTENCAO: { nome: "Manutenção", base: false, resumo: "Fichas, preventivas e prestadores.", telas: ["Manutenção", "Preventivas", "Prestadores"] },
  VIDA: { nome: "Vida em condomínio", base: false, resumo: "Reservas, enquetes, assembleias e classificados.", telas: ["Reservas", "Enquetes", "Assembleias", "Classificados"] },
  COMUNICACAO_AMPLIADA: { nome: "Comunicação ampliada", base: false, resumo: "Memória do condomínio e dossiê.", telas: ["Memória", "Dossiê de transição"] },
};

export function criarPlanosConsole(condominio: string, cliente: string) {
  const agora = "2026-10-20T13:00:00Z";
  const conjuntos = Object.entries(TELAS).map(([codigo, t]) => ({
    codigo, ...t, versao: 1,
    estado: t.base ? "LIBERADO" : codigo === "MANUTENCAO" ? "NAO_LIBERADO" : codigo === "AGENDA" ? "LIBERADO" : "NAO_LIBERADO",
    modo: t.base || codigo === "AGENDA" ? "COMPLETO" : "FORA",
    contratado: t.base || codigo === "AGENDA" || codigo === "MANUTENCAO",
    ...(codigo === "AGENDA" ? { contratoReferencia: "Contrato 2026-014", liberadoEm: agora, liberadoPor: "Carolina" } : {}),
    ...(codigo === "MANUTENCAO" ? { contratoReferencia: "Aditivo 1" } : {}),
  })) as Json[];
  const cobrancas: Json[] = [{
    id: "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", condominioId: condominio, cliente, tipo: "MENSALIDADE", competencia: "2026-09-01",
    valor: 34900, ajustes: 0, devido: 34900, conferido: 0, aConferir: 0, falta: 34900, venceEm: "2026-09-10", situacao: "ABERTA",
    emAtraso: true, diasDeAtraso: 44, versao: 1,
  }];
  return {
    condominio, cliente, conjuntos, cobrancas,
    plano: { nome: "Essencial", unidadesDe: 1, unidadesAte: 60, valor: 34900, ciclo: "MENSAL", diaVencimento: 10, implantacaoSemCobranca: true,
      inicioCompetencia: "2026-09-01", desde: agora, versao: 1 } as Json | undefined,
    recebimentos: [] as Json[],
    avulsos: [] as Json[],
    ajustes: [] as Json[],
    historico: [{ acao: "cobranca.aberta", em: "2026-09-01T12:00:00Z", autor: "Carolina", dados: {} }] as Json[],
    /** O corpo do último PUT do plano, para o teste conferir o que foi enviado. */
    ultimoPlano: undefined as Json | undefined,
  };
}

export type PlanosConsole = ReturnType<typeof criarPlanosConsole>;

function erro(route: Route, status: number, codigo: string, detalhes?: Json) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** Refaz o devido, o conferido e a situação de uma cobrança. */
function recontar(p: PlanosConsole, c: Json) {
  const deste = p.recebimentos.filter((r) => r.cobrancaId === c.id);
  const soma = (e: string) => deste.filter((r) => r.estado === e).reduce((n, r) => n + Number(r.valor), 0);
  c.conferido = soma("CONFERIDO");
  c.aConferir = soma("A_CONFERIR");
  if (c.valor === undefined) return;
  c.devido = Number(c.valor) + Number(c.ajustes);
  c.falta = Math.max(Number(c.devido) - Number(c.conferido), 0);
  c.situacao = c.falta === 0 ? "QUITADA" : Number(c.conferido) > 0 ? "PARCIAL" : "ABERTA";
  if (c.situacao === "QUITADA") c.emAtraso = false;
}

const marcar = (p: PlanosConsole, acao: string) => p.historico.unshift({ acao, em: new Date().toISOString(), autor: "Carolina", dados: {} });

/** As rotas da aba Plano e pagamentos, de Pagamentos e de uma cobrança; null quando não é daqui. */
export async function rotasPlanosConsole(route: Route, p: PlanosConsole, caminho: string, metodo: string, corpo: Json, admin: boolean) {
  const base = `/v1/clientes/${p.condominio}`;
  if (caminho === `${base}/plano` && metodo === "GET") {
    return route.fulfill({ json: { plano: p.plano, unidadesAtivas: 42, conjuntos: p.conjuntos, ...(admin ? { cobrancas: p.cobrancas } : {}), permissoes: [] } });
  }
  if (caminho === `${base}/plano` && metodo === "PUT") {
    if (String(corpo.nome ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    const { tabela, ...resto } = corpo;
    p.ultimoPlano = corpo;
    if (tabela === "FUNDADOR" && corpo.ciclo === "ANUAL") return erro(route, 400, "VALIDATION_ERROR", { motivo: "FUNDADOR_SO_MENSAL" });
    p.plano = { ...p.plano, ...resto, desde: p.plano?.desde ?? new Date().toISOString(), versao: Number(p.plano?.versao ?? 0) + 1 };
    if (corpo.valor === null) delete p.plano.valor;
    // A origem do valor (0295): a tabela de fundador, a cheia ou nada, quando foi à mão.
    if (tabela === "FUNDADOR" || tabela === "CHEIA") p.plano.tabelaOrigem = tabela;
    else delete p.plano.tabelaOrigem;
    if (tabela === "FUNDADOR") {
      const [a, m] = String(corpo.inicioCompetencia).split("-").map(Number) as [number, number];
      const t = a * 12 + (m - 1) + 11;
      p.plano.fundadorAte = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
    } else delete p.plano.fundadorAte;
    return route.fulfill({ json: { plano: p.plano } });
  }
  const cj = new RegExp(`^${base}/conjuntos/([A-Z_]+)/(contrato|liberar|teste|suspender)$`).exec(caminho);
  if (cj) {
    const c = p.conjuntos.find((x) => x.codigo === cj[1] && !x.base);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (cj[2] !== "contrato" && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (cj[2] === "contrato") {
      c.contratado = !!corpo.contratado;
      if (!c.contratado && c.estado === "LIBERADO") Object.assign(c, { estado: "SUSPENSO", modo: "CONSULTA", suspensoEm: new Date().toISOString(), suspensaoPorque: "CONTRATO_ENCERRADO" });
    }
    if (cj[2] === "liberar") Object.assign(c, { estado: "LIBERADO", modo: "COMPLETO", liberadoEm: new Date().toISOString(), liberadoPor: "Carolina" });
    if (cj[2] === "teste") Object.assign(c, { estado: "TESTE", modo: "COMPLETO", testeAte: corpo.ate, testeMotivo: corpo.motivo });
    if (cj[2] === "suspender") {
      if (!corpo.porque) return erro(route, 400, "VALIDATION_ERROR", { campos: ["porque"] });
      Object.assign(c, { estado: "SUSPENSO", modo: "CONSULTA", suspensoEm: new Date().toISOString(), suspensaoPorque: corpo.porque });
    }
    c.versao = Number(c.versao) + 1;
    return route.fulfill({ json: { estado: c.estado, versao: c.versao } });
  }
  if (caminho === "/v1/pagamentos" && metodo === "GET") {
    if (!admin) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: {
      cobrancas: p.cobrancas,
      aConferir: p.recebimentos.filter((r) => r.estado === "A_CONFERIR").map((r) => ({ ...r, condominioId: p.condominio, cliente: p.cliente })),
      naoIdentificados: p.avulsos, podeRegistrar: true,
    } });
  }
  if (caminho === "/v1/pagamentos/competencias") {
    const competencia = `${String(corpo.competencia).slice(0, 7)}-01`;
    if (p.cobrancas.some((c) => c.competencia === competencia)) return route.fulfill({ json: { criadas: 0, jaAbertas: 1, semPlano: 0 } });
    p.cobrancas.unshift({ id: crypto.randomUUID(), condominioId: p.condominio, cliente: p.cliente, tipo: "MENSALIDADE", competencia, valor: 34900, ajustes: 0,
      devido: 34900, conferido: 0, aConferir: 0, falta: 34900, venceEm: `${competencia.slice(0, 8)}10`, situacao: "ABERTA", emAtraso: false, versao: 1 });
    return route.fulfill({ json: { criadas: 1, jaAbertas: 0, semPlano: 0 } });
  }
  if (caminho === "/v1/pagamentos/recebimentos") {
    if (!corpo.referencia || String(corpo.referencia).trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["referencia"] });
    const r = { id: crypto.randomUUID(), valor: corpo.valor, recebidoEm: corpo.recebidoEm, forma: corpo.forma, referencia: corpo.referencia,
      registradoEm: new Date().toISOString(), registradoPor: "Carolina", versao: 1 };
    if (!corpo.condominioId) { p.avulsos.unshift(r); return route.fulfill({ status: 201, json: { id: r.id, avulso: true } }); }
    p.recebimentos.unshift({ ...r, cobrancaId: corpo.cobrancaId, estado: "A_CONFERIR" });
    recontar(p, p.cobrancas.find((c) => c.id === corpo.cobrancaId)!);
    marcar(p, "recebimento.registrado");
    return route.fulfill({ status: 201, json: { id: r.id } });
  }
  const ident = /^\/v1\/pagamentos\/nao-identificados\/([0-9a-f-]{36})\/identificar$/.exec(caminho);
  if (ident) {
    const a = p.avulsos.find((x) => x.id === ident[1]);
    if (!a) return erro(route, 422, "VALIDATION_ERROR", { motivo: "RECEBIMENTO_RESOLVIDO" });
    p.avulsos = p.avulsos.filter((x) => x !== a);
    p.recebimentos.unshift({ ...a, cobrancaId: corpo.cobrancaId, estado: "A_CONFERIR" });
    recontar(p, p.cobrancas.find((c) => c.id === corpo.cobrancaId)!);
    marcar(p, "recebimento.identificado");
    return route.fulfill({ json: { id: a.id } });
  }
  const rec = new RegExp(`^${base}/recebimentos/([0-9a-f-]{36})/(conferir|devolver)$`).exec(caminho);
  if (rec) {
    const r = p.recebimentos.find((x) => x.id === rec[1]);
    if (!r) return erro(route, 404, "NOT_FOUND");
    if (r.estado !== "A_CONFERIR") return erro(route, 422, "VALIDATION_ERROR", { motivo: "JA_CONFIRMADO" });
    if (rec[2] === "devolver" && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    r.estado = rec[2] === "conferir" ? "CONFERIDO" : "DEVOLVIDO";
    if (rec[2] === "devolver") r.devolvidoMotivo = corpo.motivo;
    r.versao = Number(r.versao) + 1;
    recontar(p, p.cobrancas.find((c) => c.id === r.cobrancaId)!);
    marcar(p, rec[2] === "conferir" ? "recebimento.conferido" : "recebimento.devolvido");
    return route.fulfill({ json: { estado: r.estado } });
  }
  const cob = new RegExp(`^${base}/cobrancas/([0-9a-f-]{36})(/ajustes|/valor)?$`).exec(caminho);
  if (cob) {
    const c = p.cobrancas.find((x) => x.id === cob[1]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (!cob[2]) {
      return route.fulfill({ json: { ...c, plano: p.plano?.nome, listaAjustes: p.ajustes, recebimentos: p.recebimentos.filter((r) => r.cobrancaId === c.id),
        historico: p.historico, permissoes: { registrar: admin, conferir: admin, ajustar: admin } } });
    }
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (cob[2] === "/ajustes") {
      const valor = Number(corpo.valor);
      p.ajustes.push({ id: crypto.randomUUID(), tipo: corpo.tipo, valor, motivo: corpo.motivo, autor: "Carolina", em: new Date().toISOString() });
      c.ajustes = Number(c.ajustes) + valor;
      marcar(p, "cobranca.ajustada");
    } else {
      c.valor = corpo.valor;
      marcar(p, "cobranca.valor_definido");
    }
    recontar(p, c);
    c.versao = Number(c.versao) + 1;
    return route.fulfill({ json: { versao: c.versao } });
  }
  return null;
}

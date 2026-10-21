// Parte da manutenção da API falsa da Plataforma (peça R6). As regras de verdade estão testadas
// no banco (pgTAP 015) e na API (Deno); aqui só o bastante para a tela: lista com atalhos,
// registrar, situação, providências, concluir sem encerrar o pedido, vistoria, preventivas e
// prestadores.
import type { Route } from "@playwright/test";
import { hojeFalso, somar } from "./api-falsa-agenda";

let n = 0;
const novoId = () => `7e8f9a0b-1c2d-4e3f-8a4b-${String(++n).padStart(12, "0")}`;

interface Pessoa { vinculoId: string; nome: string; funcao: string; cargo: string | null }
interface PedidoFalso { id: string; protocolo: string; assunto: string; estado: string }
type Executor = { tipo: "PRESTADOR" | "EQUIPE" | "TEXTO"; id?: string; nome: string } | undefined;

interface PrestadorFalso {
  id: string; nome: string; servico: string; contato: string | null; telefone: string | null; email: string | null; documento: string | null;
  acordo: "CONTRATO" | "CHAMADO"; contratoAte: string | null; desde: string | null; reservaId: string | null; observacao: string | null;
  arquivado: boolean; versao: number;
}
interface ManutencaoFalsa {
  id: string; tipo: string; titulo: string; local: string; detalhes: string | null; prioridadeId: string | null; responsavelId: string;
  prestadorId: string | null; executorVinculo: string | null; executorTexto: string | null; estado: string; etapaId: string | null;
  proximoRetorno: string | null; previsao: string | null; dataPrevista: string | null; pendencia: { tipo: string; motivo: string; desde: string } | null;
  pedidoId: string | null; preventivaId: string | null; origemId: string | null; conclusao: { texto: string; realizadaEm: string; em: string; por: string } | null;
  criadoEm: string; versao: number;
  providencias: { id: string; texto: string; executor: Executor; feitaEm?: string; resultado?: string; criadoEm: string }[];
  itens: { id: string; texto: string; ordem: number; resultado?: string; observacao?: string; geradaId?: string }[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}
interface PreventivaFalsa {
  id: string; atividade: string; local: string; unidadeTempo: "SEMANA" | "MES" | "ANO"; intervalo: number; proximaData: string; antecedenciaDias: number;
  responsavelId: string; prestadorId: string | null; executorTexto: string | null; ativa: boolean; versao: number;
}

export interface EstadoManutencao {
  prestadores: PrestadorFalso[];
  manutencoes: ManutencaoFalsa[];
  preventivas: PreventivaFalsa[];
  etapas: { id: string; nome: string; situacao: string; ordem: number; ativa: boolean; versao: number }[];
}

/** O prédio do Residencial Ipê: a bomba com ruído (ligada ao pedido 2026-0001), a infiltração pendente com retorno vencido e a vistoria da fachada. */
export function criarManutencao(vAna: string, vBruna: string, pedido: PedidoFalso, prioridadeAlta: string): EstadoManutencao {
  const h = hojeFalso();
  const agora = Date.now();
  const p = (m: Partial<PrestadorFalso> & { nome: string; servico: string }): PrestadorFalso => ({
    id: novoId(), contato: null, telefone: null, email: null, documento: null, acordo: "CHAMADO", contratoAte: null, desde: null, reservaId: null,
    observacao: null, arquivado: false, versao: 1, ...m,
  });
  const litoral = p({ nome: "Bombas Litoral", servico: "Bombas" });
  const hidro = p({ nome: "HidroPress Bombas", servico: "Bombas e pressurização", contato: "Marcos", telefone: "+5513998124455", reservaId: litoral.id });
  const aqua = p({ nome: "Aqualimp", servico: "Limpeza de reservatórios", acordo: "CONTRATO", contratoAte: somar(h, 40), contato: "Sônia" });
  const impermeabiliza = p({ nome: "Impermeabiliza Sul", servico: "Impermeabilização", telefone: "+551333017788" });
  const etapa = { id: novoId(), nome: "Aguardando visita", situacao: "EM_ANDAMENTO", ordem: 1, ativa: true, versao: 1 };
  const m = (x: Partial<ManutencaoFalsa> & { titulo: string; local: string }): ManutencaoFalsa => ({
    id: novoId(), tipo: "CORRETIVA", detalhes: null, prioridadeId: prioridadeAlta, responsavelId: vAna, prestadorId: null, executorVinculo: null,
    executorTexto: null, estado: "PLANEJADA", etapaId: null, proximoRetorno: null, previsao: null, dataPrevista: null, pendencia: null, pedidoId: null,
    preventivaId: null, origemId: null, conclusao: null, criadoEm: new Date(agora - 86400_000).toISOString(), versao: 1, providencias: [], itens: [],
    historico: [{ acao: "manutencao.registrada", em: new Date(agora - 86400_000).toISOString(), autor: "Ana Souza", dados: { tipo: x.tipo ?? "CORRETIVA" } }], ...x,
  });
  const bomba = m({ titulo: "Bomba de recalque com ruído", local: "Casa de bombas · Bomba 2", estado: "EM_ANDAMENTO", etapaId: etapa.id, responsavelId: vBruna,
    prestadorId: hidro.id, proximoRetorno: new Date(agora + 5 * 3600_000).toISOString(), previsao: somar(h, 1), pedidoId: pedido.id,
    providencias: [
      { id: novoId(), texto: "Isolar a bomba 2 e deixar a 1 operando", executor: { tipo: "EQUIPE", id: vBruna, nome: "Bruna" }, feitaEm: new Date(agora - 3600_000).toISOString(),
        resultado: "Bomba 2 desligada no quadro.", criadoEm: new Date(agora - 7200_000).toISOString() },
      { id: novoId(), texto: "Diagnóstico e troca do rolamento", executor: { tipo: "PRESTADOR", id: hidro.id, nome: hidro.nome }, criadoEm: new Date(agora - 3600_000).toISOString() },
    ] });
  const infiltracao = m({ titulo: "Infiltração na garagem, vaga 14", local: "Garagem · subsolo 1", estado: "PENDENTE", prestadorId: impermeabiliza.id,
    proximoRetorno: new Date(agora - 20 * 3600_000).toISOString(), pendencia: { tipo: "PECA", motivo: "Manta encomendada", desde: new Date(agora - 5 * 86400_000).toISOString() } });
  const fachada = m({ titulo: "Vistoria da fachada antes da chuva", local: "Fachada e calhas", tipo: "VISTORIA", estado: "EM_ANDAMENTO", executorVinculo: vBruna,
    itens: [{ id: novoId(), texto: "Calhas e rufos sem entupimento", ordem: 1, resultado: "CERTO" }, { id: novoId(), texto: "Trincas na fachada leste", ordem: 2 },
      { id: novoId(), texto: "Ralos da cobertura", ordem: 3 }] });
  const caixa: PreventivaFalsa = { id: novoId(), atividade: "Limpeza dos reservatórios de água", local: "Caixas-d'água", unidadeTempo: "MES", intervalo: 6,
    proximaData: somar(h, 4), antecedenciaDias: 15, responsavelId: vAna, prestadorId: aqua.id, executorTexto: null, ativa: true, versao: 1 };
  const extintores: PreventivaFalsa = { id: novoId(), atividade: "Recarga dos extintores", local: "Todos os andares", unidadeTempo: "ANO", intervalo: 1,
    proximaData: somar(h, -10), antecedenciaDias: 15, responsavelId: vAna, prestadorId: null, executorTexto: "FogoZero", ativa: true, versao: 1 };
  const mCaixa = m({ titulo: caixa.atividade, local: caixa.local, tipo: "PREVENTIVA", prestadorId: aqua.id, prioridadeId: null, preventivaId: caixa.id,
    dataPrevista: caixa.proximaData, previsao: caixa.proximaData });
  const mExtintores = m({ titulo: extintores.atividade, local: extintores.local, tipo: "PREVENTIVA", executorTexto: "FogoZero", prioridadeId: null,
    preventivaId: extintores.id, dataPrevista: extintores.proximaData, previsao: extintores.proximaData });
  return {
    prestadores: [litoral, hidro, aqua, impermeabiliza],
    manutencoes: [bomba, infiltracao, fachada, mCaixa, mExtintores],
    preventivas: [caixa, extintores],
    etapas: [etapa],
  };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const ABERTAS = ["PLANEJADA", "EM_ANDAMENTO", "PENDENTE"];

export function resumoManutencao(est: EstadoManutencao) {
  const hoje = hojeFalso();
  const abertas = est.manutencoes.filter((m) => ABERTAS.includes(m.estado));
  const vencidas = abertas.filter((m) => m.proximoRetorno && Date.parse(m.proximoRetorno) < Date.now());
  const atrasadas = abertas.filter((m) => m.dataPrevista && m.dataPrevista < hoje);
  const contratos = est.prestadores.filter((p) => !p.arquivado && p.contratoAte && p.contratoAte >= hoje && p.contratoAte <= somar(hoje, 60));
  return {
    abertas: abertas.length, retornoVencido: vencidas.length,
    ...(vencidas[0] ? { vencidaMaisAntiga: { id: vencidas[0].id, titulo: vencidas[0].titulo, desde: vencidas[0].proximoRetorno } } : {}),
    preventivasAtrasadas: atrasadas.length,
    ...(atrasadas[0] ? { atrasadaMaisAntiga: { id: atrasadas[0].id, titulo: atrasadas[0].titulo, data: atrasadas[0].dataPrevista } } : {}),
    contratosAVencer: contratos.length,
    ...(contratos[0] ? { contratoMaisProximo: { id: contratos[0].id, nome: contratos[0].nome, ate: contratos[0].contratoAte } } : {}),
  };
}

export async function rotasManutencao(route: Route, est: EstadoManutencao, ctx: {
  pessoas: Pessoa[]; pedidos: PedidoFalso[]; prioridades: { id: string; nome: string; significado: string; nivel: number }[]; eu: { vinculo: string; nome: string };
}, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean) {
  const pm = /^\/v1\/condominio\/pedidos\/([^/]+)\/manutencao$/.exec(caminho);
  if (!caminho.startsWith("/v1/condominio/manutencao") && !caminho.startsWith("/v1/condominio/etapas-manutencao") && !pm) return null;
  const hoje = hojeFalso();
  const nomeVinculo = (v: string | null) => ctx.pessoas.find((p) => p.vinculoId === v)?.nome ?? null;
  const executor = (prestadorId: string | null, vinculo: string | null, texto: string | null): Executor => {
    const p = est.prestadores.find((x) => x.id === prestadorId);
    if (p) return { tipo: "PRESTADOR", id: p.id, nome: p.nome };
    if (vinculo) return { tipo: "EQUIPE", id: vinculo, nome: nomeVinculo(vinculo) ?? "" };
    return texto ? { tipo: "TEXTO", nome: texto } : undefined;
  };
  const json = (m: ManutencaoFalsa) => {
    const pri = ctx.prioridades.find((x) => x.id === m.prioridadeId);
    const ped = ctx.pedidos.find((x) => x.id === m.pedidoId);
    const etapa = est.etapas.find((e) => e.id === m.etapaId);
    return {
      id: m.id, tipo: m.tipo, titulo: m.titulo, local: m.local, estado: m.estado, etapa: etapa ? { id: etapa.id, nome: etapa.nome } : undefined,
      prioridade: pri ? { id: pri.id, nome: pri.nome, nivel: pri.nivel } : undefined, responsavel: { vinculoId: m.responsavelId, nome: nomeVinculo(m.responsavelId) },
      executor: executor(m.prestadorId, m.executorVinculo, m.executorTexto), proximoRetorno: m.proximoRetorno ?? undefined,
      retornoVencido: ABERTAS.includes(m.estado) && !!m.proximoRetorno && Date.parse(m.proximoRetorno) < Date.now(),
      previsao: m.previsao ?? undefined, dataPrevista: m.dataPrevista ?? undefined, atrasada: ABERTAS.includes(m.estado) && !!m.dataPrevista && m.dataPrevista < hoje,
      pendencia: m.estado === "PENDENTE" ? m.pendencia ?? undefined : undefined,
      pedido: ped && pode("pedidos.ver") ? { id: ped.id, protocolo: ped.protocolo, assunto: ped.assunto, estado: ped.estado } : undefined,
      preventivaId: m.preventivaId ?? undefined, criadoEm: m.criadoEm, versao: m.versao, realizadaEm: m.conclusao?.realizadaEm,
    };
  };
  const prestadorJson = (p: PrestadorFalso) => ({
    id: p.id, nome: p.nome, servico: p.servico, contato: p.contato ?? undefined, telefone: p.telefone ?? undefined, email: p.email ?? undefined,
    documento: p.documento ?? undefined, acordo: p.acordo, contratoAte: p.contratoAte ?? undefined, desde: p.desde ?? undefined, observacao: p.observacao ?? undefined,
    reserva: est.prestadores.filter((r) => r.id === p.reservaId).map((r) => ({ id: r.id, nome: r.nome }))[0], arquivado: p.arquivado,
    abertas: est.manutencoes.filter((m) => m.prestadorId === p.id && ["PLANEJADA", "EM_ANDAMENTO"].includes(m.estado)).length,
    pendentes: est.manutencoes.filter((m) => m.prestadorId === p.id && m.estado === "PENDENTE").length,
    contratoVence: p.acordo === "CONTRATO" && !!p.contratoAte && p.contratoAte >= hoje && p.contratoAte <= somar(hoje, 60),
    contratoVencido: p.acordo === "CONTRATO" && !!p.contratoAte && p.contratoAte < hoje, versao: p.versao,
  });
  const hist = (m: ManutencaoFalsa, acao: string, dados: Record<string, unknown>) => m.historico.unshift({ acao, em: new Date().toISOString(), autor: ctx.eu.nome, dados });

  if (pm) {
    if (!pode("manutencao.ver")) return route.fulfill({ json: { podeVer: false, podeAbrir: false, manutencoes: [] } });
    return route.fulfill({ json: { podeVer: true, podeAbrir: pode("manutencao.editar"),
      manutencoes: est.manutencoes.filter((m) => m.pedidoId === pm[1] && m.estado !== "CANCELADA").map(json) } });
  }
  if (caminho.startsWith("/v1/condominio/etapas-manutencao")) {
    // Mudar as etapas é ajuste da TRÍADE: só pelo Console (0283).
    if (metodo === "GET") return route.fulfill({ json: { etapas: est.etapas, podeEditar: pode("config.editar") } });
    return erro(route, 404, "NOT_FOUND");
  }
  if (!pode("manutencao.ver")) return erro(route, 403, "FORBIDDEN");

  if (caminho === "/v1/condominio/manutencao/opcoes") {
    return route.fulfill({ json: {
      pessoas: ctx.pessoas.map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, cargo: p.cargo, eu: p.vinculoId === ctx.eu.vinculo, veManutencao: true })),
      prestadores: est.prestadores.filter((p) => !p.arquivado).map((p) => ({ id: p.id, nome: p.nome, servico: p.servico })),
      prioridades: ctx.prioridades, etapas: est.etapas.filter((e) => e.ativa).map((e) => ({ id: e.id, nome: e.nome, situacao: e.situacao })),
      locais: [...new Set(est.manutencoes.map((m) => m.local))].sort(),
      pedidos: ctx.pedidos.filter((p) => ["ABERTO", "EM_ANDAMENTO"].includes(p.estado)).map((p) => ({ id: p.id, protocolo: p.protocolo, assunto: p.assunto })),
      pode: { editar: pode("manutencao.editar"), agenda: pode("agenda.editar") }, pendenciaDias: 3, hoje,
    } });
  }
  if (caminho === "/v1/condominio/manutencao" && metodo === "GET") {
    const situacao = url.searchParams.get("situacao") ?? "ABERTAS";
    const atencao = url.searchParams.get("atencao");
    const tipo = url.searchParams.get("tipo");
    const busca = (url.searchParams.get("busca") ?? "").toLowerCase();
    const todas = est.manutencoes.map((m) => ({ m, j: json(m) }));
    const itens = todas.filter(({ m, j }) => (situacao === "ABERTAS" ? ABERTAS.includes(m.estado) : situacao === "TODAS" || m.estado === situacao)
      && (!tipo || m.tipo === tipo) && (!busca || m.titulo.toLowerCase().includes(busca) || m.local.toLowerCase().includes(busca))
      && (atencao !== "RETORNO_VENCIDO" || j.retornoVencido) && (atencao !== "PENDENTES_PARADAS" || m.estado === "PENDENTE")
      && (atencao !== "PREVENTIVAS_MES" || (m.tipo === "PREVENTIVA" && ABERTAS.includes(m.estado))))
      .sort((a, b) => Number(b.j.retornoVencido) - Number(a.j.retornoVencido)).map((x) => x.j);
    const abertas = todas.filter(({ m }) => ABERTAS.includes(m.estado));
    return route.fulfill({ json: { itens, total: itens.length, pagina: 1, pendenciaDias: 3, pode: { editar: pode("manutencao.editar") },
      atalhos: { retornoVencido: abertas.filter((x) => x.j.retornoVencido).length, preventivasMes: abertas.filter((x) => x.m.tipo === "PREVENTIVA").length,
        pendentesParadas: abertas.filter((x) => x.m.estado === "PENDENTE").length } } });
  }
  if (caminho === "/v1/condominio/manutencao/preventivas" && metodo === "GET") {
    return route.fulfill({ json: { hoje, pode: { editar: pode("manutencao.editar") }, itens: est.preventivas.map((p) => {
      const aberta = est.manutencoes.find((m) => m.preventivaId === p.id && ABERTAS.includes(m.estado));
      return { id: p.id, atividade: p.atividade, local: p.local, unidadeTempo: p.unidadeTempo, intervalo: p.intervalo, proximaData: p.proximaData,
        antecedenciaDias: p.antecedenciaDias, responsavel: { vinculoId: p.responsavelId, nome: nomeVinculo(p.responsavelId) },
        executor: executor(p.prestadorId, null, p.executorTexto), ativa: p.ativa, versao: p.versao, aberta: aberta ? json(aberta) : undefined };
    }) } });
  }
  if (caminho === "/v1/condominio/manutencao/prestadores" && metodo === "GET") {
    const arquivados = url.searchParams.get("arquivados") === "1";
    return route.fulfill({ json: { itens: est.prestadores.filter((p) => p.arquivado === arquivados).map(prestadorJson),
      arquivados: est.prestadores.filter((p) => p.arquivado).length, pode: { editar: pode("manutencao.editar") } } });
  }
  const pid = /^\/v1\/condominio\/manutencao\/prestadores\/([^/]+)(\/arquivar)?$/.exec(caminho);
  if (pid && metodo === "GET") {
    const p = est.prestadores.find((x) => x.id === pid[1]);
    if (!p) return erro(route, 404, "NOT_FOUND");
    return route.fulfill({ json: { prestador: prestadorJson(p), manutencoes: est.manutencoes.filter((m) => m.prestadorId === p.id).map(json),
      reservaDe: est.prestadores.filter((r) => r.reservaId === p.id).map((r) => ({ id: r.id, nome: r.nome })), pode: { editar: pode("manutencao.editar") } } });
  }

  // Daqui em diante, mudar.
  if (!pode("manutencao.editar")) return erro(route, 403, "FORBIDDEN");

  if (pid && pid[2]) {
    const p = est.prestadores.find((x) => x.id === pid[1])!;
    p.arquivado = corpo.arquivar === true; p.versao++;
    return route.fulfill({ json: { versao: p.versao } });
  }
  if (caminho === "/v1/condominio/manutencao/prestadores" || pid) {
    const nome = String(corpo.nome ?? "").trim();
    const ruins: string[] = [];
    if (nome.length < 2 || est.prestadores.some((x) => !x.arquivado && x.id !== pid?.[1] && x.nome.toLowerCase() === nome.toLowerCase())) ruins.push("nome");
    if (String(corpo.servico ?? "").trim().length < 2) ruins.push("servico");
    if (corpo.contratoAte && corpo.acordo !== "CONTRATO") ruins.push("contratoAte");
    if (ruins.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ruins });
    const dados = { nome, servico: String(corpo.servico).trim(), contato: (corpo.contato as string) ?? null, telefone: (corpo.telefone as string) ?? null,
      email: (corpo.email as string) ?? null, documento: (corpo.documento as string) ?? null, acordo: corpo.acordo as "CONTRATO" | "CHAMADO",
      contratoAte: (corpo.contratoAte as string) ?? null, desde: (corpo.desde as string) ?? null, reservaId: (corpo.reservaId as string) ?? null,
      observacao: (corpo.observacao as string) ?? null };
    if (pid) {
      const p = est.prestadores.find((x) => x.id === pid[1])!;
      Object.assign(p, dados); p.versao++;
      return route.fulfill({ json: { id: p.id, versao: p.versao } });
    }
    const p = { id: novoId(), ...dados, arquivado: false, versao: 1 };
    est.prestadores.push(p);
    return route.fulfill({ status: 201, json: { id: p.id, versao: 1 } });
  }
  if (caminho.startsWith("/v1/condominio/manutencao/preventivas")) {
    const ruins: string[] = [];
    if (String(corpo.atividade ?? "").trim().length < 3) ruins.push("atividade");
    if (!corpo.proximaData) ruins.push("proximaData");
    if (!corpo.responsavelId) ruins.push("responsavelId");
    if (ruins.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ruins });
    const p: PreventivaFalsa = { id: novoId(), atividade: String(corpo.atividade), local: String(corpo.local), unidadeTempo: corpo.unidadeTempo as "MES",
      intervalo: Number(corpo.intervalo), proximaData: String(corpo.proximaData), antecedenciaDias: Number(corpo.antecedenciaDias), responsavelId: String(corpo.responsavelId),
      prestadorId: (corpo.prestadorId as string) ?? null, executorTexto: (corpo.executorTexto as string) ?? null, ativa: true, versao: 1 };
    est.preventivas.push(p);
    return route.fulfill({ status: 201, json: { id: p.id, versao: 1, abertas: 0 } });
  }
  if (caminho === "/v1/condominio/manutencao" && metodo === "POST") {
    const ruins: string[] = [];
    if (String(corpo.titulo ?? "").trim().length < 3) ruins.push("titulo");
    if (String(corpo.local ?? "").trim().length < 2) ruins.push("local");
    if (!corpo.prioridadeId) ruins.push("prioridadeId");
    if (!corpo.responsavelId) ruins.push("responsavelId");
    if (ruins.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ruins });
    const m: ManutencaoFalsa = {
      id: novoId(), tipo: String(corpo.tipo), titulo: String(corpo.titulo).trim(), local: String(corpo.local).trim(), detalhes: (corpo.detalhes as string) ?? null,
      prioridadeId: String(corpo.prioridadeId), responsavelId: String(corpo.responsavelId), prestadorId: (corpo.prestadorId as string) ?? null,
      executorVinculo: (corpo.executorVinculoId as string) ?? null, executorTexto: (corpo.executorTexto as string) ?? null, estado: "PLANEJADA", etapaId: null,
      proximoRetorno: (corpo.proximoRetorno as string) ?? null, previsao: (corpo.previsao as string) ?? null, dataPrevista: null, pendencia: null,
      pedidoId: (corpo.pedidoId as string) ?? null, preventivaId: null, origemId: null, conclusao: null, criadoEm: new Date().toISOString(), versao: 1,
      providencias: [], itens: ((corpo.itens as string[]) ?? []).map((t, i) => ({ id: novoId(), texto: t, ordem: i + 1 })), historico: [],
    };
    hist(m, "manutencao.registrada", { tipo: m.tipo });
    est.manutencoes.push(m);
    return route.fulfill({ status: 201, json: { id: m.id } });
  }

  const mid = /^\/v1\/condominio\/manutencao\/([^/]+)(\/.*)?$/.exec(caminho);
  const m = mid ? est.manutencoes.find((x) => x.id === mid[1]) : undefined;
  if (!m) return erro(route, 404, "NOT_FOUND");
  const acao = mid![2] ?? "";
  if (metodo === "GET" && acao === "") {
    const prest = est.prestadores.find((x) => x.id === m.prestadorId);
    const res = est.prestadores.find((x) => x.id === prest?.reservaId);
    const origem = est.manutencoes.find((x) => x.id === m.origemId);
    const prev = est.preventivas.find((x) => x.id === m.preventivaId);
    return route.fulfill({ json: {
      manutencao: { ...json(m), detalhes: m.detalhes ?? undefined, registradaPor: "Ana Souza",
        conclusao: m.conclusao ?? undefined, origem: origem ? { id: origem.id, titulo: origem.titulo, tipo: origem.tipo } : undefined,
        preventiva: prev ? { id: prev.id, unidadeTempo: prev.unidadeTempo, intervalo: prev.intervalo, proximaData: prev.proximaData } : undefined },
      prestador: prest ? { id: prest.id, nome: prest.nome, servico: prest.servico, acordo: prest.acordo, contato: prest.contato ?? undefined,
        telefone: prest.telefone ?? undefined, reserva: res ? { id: res.id, nome: res.nome } : undefined } : undefined,
      providencias: m.providencias,
      itens: m.itens.map((i) => {
        const g = est.manutencoes.find((x) => x.id === i.geradaId);
        return { ...i, fotos: 0, gerada: g ? { id: g.id, titulo: g.titulo, estado: g.estado } : undefined };
      }),
      geradas: est.manutencoes.filter((x) => x.origemId === m.id).map((x) => ({ id: x.id, titulo: x.titulo, estado: x.estado })),
      compromissos: [], historico: m.historico,
      pode: { editar: pode("manutencao.editar") && ABERTAS.includes(m.estado), reabrir: pode("manutencao.editar") && !ABERTAS.includes(m.estado),
        enviar: pode("manutencao.editar") && m.estado !== "CANCELADA", marcarVisita: false },
      hoje,
    } });
  }
  if (metodo === "GET" && acao === "/arquivos") return route.fulfill({ json: { arquivos: [], pode: { enviar: pode("manutencao.editar") }, limites: { porManutencao: 30, tamanho: 10485760 } } });
  if (corpo.versao !== m.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: m.versao });

  if (acao === "/situacao") {
    if (corpo.estado === "PENDENTE" && (!corpo.pendenciaTipo || String(corpo.pendenciaMotivo ?? "").trim().length < 3)) {
      return erro(route, 400, "VALIDATION_ERROR", { campos: [...(corpo.pendenciaTipo ? [] : ["pendenciaTipo"]), ...(String(corpo.pendenciaMotivo ?? "").trim().length < 3 ? ["pendenciaMotivo"] : [])] });
    }
    if (corpo.estado !== m.estado) hist(m, "estado.mudou", { de: m.estado, para: corpo.estado });
    if (m.estado === "PENDENTE" && corpo.estado !== "PENDENTE") hist(m, "manutencao.situacao", { estado: corpo.estado, pendenciaResolvida: true });
    m.pendencia = corpo.estado === "PENDENTE" ? { tipo: String(corpo.pendenciaTipo), motivo: String(corpo.pendenciaMotivo), desde: new Date().toISOString() } : null;
    m.estado = String(corpo.estado); m.etapaId = (corpo.etapaId as string) ?? null; m.versao++;
    return route.fulfill({ json: { versao: m.versao } });
  }
  if (acao === "/concluir") {
    if (String(corpo.conclusao ?? "").trim().length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["conclusao"] });
    const abertas = m.providencias.filter((p) => !p.feitaEm);
    if (abertas.length && corpo.fecharProvidencias !== true) {
      return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROVIDENCIAS_ABERTAS", providencias: abertas.map((p) => ({ id: p.id, texto: p.texto })) });
    }
    for (const p of abertas) p.feitaEm = new Date().toISOString();
    m.conclusao = { texto: String(corpo.conclusao), realizadaEm: String(corpo.realizadaEm), em: new Date().toISOString(), por: ctx.eu.nome };
    hist(m, "manutencao.concluida", { realizadaEm: corpo.realizadaEm });
    m.estado = "CONCLUIDA"; m.proximoRetorno = null; m.pendencia = null; m.versao++;
    return route.fulfill({ json: { versao: m.versao } });
  }
  if (acao === "/reabrir") {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    hist(m, "estado.mudou", { de: m.estado, para: "EM_ANDAMENTO", evento: "REABERTA", motivo: corpo.motivo });
    m.estado = m.estado === "CONCLUIDA" ? "EM_ANDAMENTO" : "PLANEJADA"; m.conclusao = null; m.versao++;
    return route.fulfill({ json: { versao: m.versao } });
  }
  if (acao === "/cancelar") {
    hist(m, "estado.mudou", { de: m.estado, para: "CANCELADA", motivo: corpo.motivo });
    m.estado = "CANCELADA"; m.versao++;
    return route.fulfill({ json: { versao: m.versao } });
  }
  if (acao === "/providencias") {
    const p = { id: novoId(), texto: String(corpo.texto), executor: executor((corpo.prestadorId as string) ?? null, (corpo.executorVinculoId as string) ?? null,
      (corpo.executorTexto as string) ?? null), criadoEm: new Date().toISOString() };
    m.providencias.push(p); m.versao++;
    hist(m, "manutencao.providencia", { texto: p.texto });
    return route.fulfill({ json: { id: p.id, versao: m.versao } });
  }
  const fz = /^\/providencias\/([^/]+)\/fazer$/.exec(acao);
  if (fz) {
    const p = m.providencias.find((x) => x.id === fz[1])!;
    p.feitaEm = new Date().toISOString(); p.resultado = String(corpo.resultado); m.versao++;
    hist(m, "manutencao.providencia_feita", { texto: p.texto });
    return route.fulfill({ json: { versao: m.versao } });
  }
  const it = /^\/itens\/([^/]+)\/(responder|manutencao)$/.exec(acao);
  if (it) {
    const i = m.itens.find((x) => x.id === it[1])!;
    if (it[2] === "responder") {
      if (corpo.resultado === "NAO_DEU" && !corpo.observacao) return erro(route, 400, "VALIDATION_ERROR", { campos: ["observacao"] });
      i.resultado = (corpo.resultado as string) ?? undefined; i.observacao = (corpo.observacao as string) ?? undefined; m.versao++;
      hist(m, "manutencao.item_respondido", { texto: i.texto, resultado: i.resultado });
      return route.fulfill({ json: { versao: m.versao } });
    }
    const nova: ManutencaoFalsa = { ...m, id: novoId(), tipo: "CORRETIVA", titulo: i.texto, estado: "PLANEJADA", origemId: m.id, itens: [], providencias: [],
      historico: [{ acao: "manutencao.registrada", em: new Date().toISOString(), autor: ctx.eu.nome, dados: { tipo: "CORRETIVA", origem: m.id } }],
      detalhes: i.observacao ?? null, versao: 1, etapaId: null };
    est.manutencoes.push(nova);
    i.geradaId = nova.id; m.versao++;
    return route.fulfill({ status: 201, json: { id: nova.id, versao: m.versao } });
  }
  if (acao === "" && metodo === "PUT") {
    Object.assign(m, { titulo: String(corpo.titulo), local: String(corpo.local), versao: m.versao + 1 });
    return route.fulfill({ json: { versao: m.versao } });
  }
  return erro(route, 404, "NOT_FOUND");
}

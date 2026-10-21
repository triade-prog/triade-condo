// Parte de pedidos da API falsa da Plataforma (passo 4). As regras de verdade estão
// testadas no banco (pgTAP 010) e na API (Deno); aqui só o bastante para a tela.
import type { Route } from "@playwright/test";
import { A101 } from "./api-falsa-moradores";
import type { EstadoMoradores } from "./api-falsa-moradores";
import { rotasArquivos } from "./api-falsa-arquivos";

export const AGORA = "2026-10-16T18:00:00.000Z";
const HORA = 3600_000;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();

let n = 0;
const novoId = () => `5c6d7e8f-9a0b-4c1d-8e2f-${String(++n).padStart(12, "0")}`;

interface Config {
  categorias: { id: string; nome: string; ativa: boolean }[];
  prioridades: { id: string; nome: string; significado: string; nivel: number; ativa: boolean }[];
  etapas: { id: string; nome: string; situacao: string; categoriaId: string | null; pausaPrazo: boolean; ativa: boolean }[];
  modelos: { id: string; titulo: string; texto: string; categoriaId: string | null; ativo: boolean }[];
  regrasPedidos: { revisao: boolean; reabertura: boolean };
}
interface Pessoa { vinculoId: string; nome: string; responsavel: boolean; disponivel: boolean }

interface Pendencia { id: string; tipo: string; motivo: string; responsavelId: string; abertaEm: string; abertaPor: string; resolvidaEm: string | null; resolvidaPor: string | null; resolucao: string | null }
interface Conclusao {
  id: string; etapa: string; etapaAnterior: string; explicacao: string; evidencia: string | null; concluidaEm: string; concluidaPor: string;
  revisao: string; revisadaEm: string | null; revisadaPor: string | null; motivoDevolucao: string | null; reabertaEm: string | null; reabertaPor: string | null; motivoReabertura: string | null;
}
interface PedidoFalso {
  id: string; protocolo: string; assunto: string; descricao: string; canal: string; privado: boolean; estado: string; local: string | null; versao: number;
  unidadeId: string | null; contatoId: string | null; categoriaId: string; prioridadeId: string; etapaId: string;
  responsavelId: string | null; desde: string | null; aceitoEm: string | null; proximoRetorno: string | null; previsao: string | null;
  abertoEm: string; registradoPor: string; encerradoEm: string | null; cancelamento: { em: string; motivo: string; por: string } | null;
  pendencias: Pendencia[]; andamentos: { id: string; tipo: string; meio: string | null; texto: string; em: string; autor: string }[];
  conclusoes: Conclusao[]; historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
}

export function criarPedidos(c: Config, vAna: string, vBruna: string) {
  const etapa = (nome: string) => c.etapas.find((e) => e.nome === nome)!.id;
  const pri = (nome: string) => c.prioridades.find((p) => p.nome === nome)!.id;
  const base = (protocolo: string, assunto: string, m: Partial<PedidoFalso>): PedidoFalso => ({
    id: novoId(), protocolo, assunto, descricao: `${assunto}. Relato fictício.`, canal: "TELEFONE", privado: false, estado: "ABERTO", local: null, versao: 1,
    unidadeId: null, contatoId: null, categoriaId: c.categorias[0]!.id, prioridadeId: pri("Normal"), etapaId: etapa("Recebido"),
    responsavelId: null, desde: null, aceitoEm: null, proximoRetorno: depois(20), previsao: null, abertoEm: depois(-48), registradoPor: "Ana Souza",
    encerradoEm: null, cancelamento: null, pendencias: [], andamentos: [], conclusoes: [],
    historico: [{ acao: "pedido.registrado", em: depois(-48), autor: "Ana Souza", dados: { protocolo, canal: "TELEFONE" } }], ...m,
  });
  return [
    base("2026-0001", "Vazamento no banheiro", {
      unidadeId: A101, estado: "EM_ANDAMENTO", etapaId: etapa("Aguardando prestador"), responsavelId: vBruna, desde: depois(-47), proximoRetorno: depois(-4),
      historico: [
        { acao: "pedido.registrado", em: depois(-48), autor: "Ana Souza", dados: { protocolo: "2026-0001", canal: "TELEFONE" } },
        { acao: "pedido.retorno_venceu", em: depois(-4), autor: null, dados: { de: depois(-4) } },
        { acao: "pedido.aviso", em: depois(-4), autor: null, dados: { tipo: "RETORNO_VENCIDO", para: "RESPONSAVEL" } },
        { acao: "pedido.aviso", em: depois(-2), autor: null, dados: { tipo: "ESCALADO_SINDICO", para: "SINDICO" } },
      ],
      pendencias: [{ id: novoId(), tipo: "SEM_EXECUTOR", motivo: "Nenhum encanador disponível esta semana", responsavelId: vAna, abertaEm: depois(-30),
        abertaPor: "Ana Souza", resolvidaEm: null, resolvidaPor: null, resolucao: null }],
    }),
    base("2026-0002", "Portão não fecha", { local: "Portão da garagem", prioridadeId: pri("Urgente"), responsavelId: vAna, desde: depois(-5), aceitoEm: depois(-5),
      abertoEm: depois(-5), canal: "OBSERVACAO" }),
    base("2026-0003", "Reclamação de barulho", { privado: true, local: "Torre B", proximoRetorno: depois(30) }),
  ];
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const ativo = (p: PedidoFalso) => p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
export const vencido = (p: PedidoFalso, c: Config) =>
  ativo(p) && !!p.proximoRetorno && p.proximoRetorno < AGORA && !c.etapas.find((e) => e.id === p.etapaId)?.pausaPrazo;

export function resumoPedidos(lista: PedidoFalso[], c: Config, eu: string) {
  const at = lista.filter((p) => ["ABERTO", "EM_ANDAMENTO", "EM_REVISAO"].includes(p.estado));
  const dia = (iso: string) => new Date(Date.parse(iso) - 3 * HORA).toISOString().slice(0, 10);
  const hoje = at.filter((p) => ativo(p) && !vencido(p, c) && p.proximoRetorno && dia(p.proximoRetorno) === dia(AGORA));
  const maisAntigo = vencidoMaisAntigo(lista, c);
  return {
    ativos: at.length,
    semResponsavel: at.filter((p) => !p.responsavelId).length,
    aguardandoAceite: at.filter((p) => p.responsavelId && !p.aceitoEm).length,
    meusParaAceitar: at.filter((p) => p.responsavelId === eu && !p.aceitoEm).length,
    retornoVencido: at.filter((p) => vencido(p, c)).length,
    emRevisao: at.filter((p) => p.estado === "EM_REVISAO").length,
    comPendencia: at.filter((p) => p.pendencias.some((x) => !x.resolvidaEm)).length,
    meus: at.filter((p) => p.responsavelId === eu).length,
    // O início do dia (passo 7).
    vencemHoje: hoje.length,
    ...(hoje.length ? { proximoHoje: hoje.map((p) => p.proximoRetorno!).sort()[0] } : {}),
    ...(maisAntigo ? { vencidoMaisAntigo: maisAntigo.proximoRetorno } : {}),
    vencidoMaisAntigoEscalado: false,
    pendenciasParadas: at.reduce((t, p) => t + p.pendencias.filter((x) => !x.resolvidaEm && Date.parse(AGORA) - Date.parse(x.abertaEm) >= 3 * 24 * HORA).length, 0),
  };
}

/** O vencido mais antigo, para o início e para saber se já subiu ao síndico. */
export function vencidoMaisAntigo(lista: PedidoFalso[], c: Config) {
  return lista.filter((p) => vencido(p, c)).sort((a, b) => a.proximoRetorno!.localeCompare(b.proximoRetorno!))[0];
}

/** O que outra parte junta ao detalhe do pedido (F7.4: relacionados e decisões). */
type DetalheExtra = (p: PedidoFalso) => { pode: Record<string, boolean> } & Record<string, unknown>;

/** Os avisos do registro (F6.4): o que sai ao registrar e o que o pedido mostra depois. */
export interface AvisosDoRegistroFalsos {
  registrar: (p: PedidoFalso, corpo: Record<string, unknown>) => { recusa: string } | { campos: string[] } | { avisos: unknown[] };
  doPedido: (id: string) => { avisos: unknown[]; prestador?: { id: string; nome: string } } | undefined;
}

/** Atende as rotas do passo 4; devolve null quando a rota não é daqui. */
export async function rotasPedidos(route: Route, ped: PedidoFalso[], c: Config, pessoas: Pessoa[], m: EstadoMoradores, eu: { vinculo: string; nome: string },
  caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL, pode: (a: string) => boolean, avisos?: AvisosDoRegistroFalsos,
  detalheExtra?: DetalheExtra) {
  if (caminho === "/v1/condominio/regras-pedidos") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    c.regrasPedidos = { revisao: corpo.revisao === true, reabertura: corpo.reabertura === true };
    return route.fulfill({ json: { versao: 2 } });
  }
  if (!caminho.startsWith("/v1/condominio/pedidos")) return null;
  if (!pode("pedidos.ver")) return erro(route, 403, "FORBIDDEN");
  const nomeVinculo = (v: string | null) => pessoas.find((p) => p.vinculoId === v)?.nome ?? "";
  const nomeUnidade = (id: string | null) => {
    const u = m.unidades.find((x) => x.id === id);
    return u ? [m.blocos.find((b) => b.id === u.blocoId)?.nome, u.identificacao].filter(Boolean).join(" · ") : null;
  };
  const disponivel = (v: unknown) => pessoas.some((p) => p.vinculoId === v && p.responsavel && p.disponivel);
  const hist = (p: PedidoFalso, acao: string, dados: Record<string, unknown> = {}) => p.historico.push({ acao, em: AGORA, autor: eu.nome, dados });
  const estado = (p: PedidoFalso, para: string, evento: string, motivo?: string) => { hist(p, "estado.mudou", { de: p.estado, para, evento, motivo }); p.estado = para; };

  if (caminho === "/v1/condominio/pedidos/opcoes") {
    return route.fulfill({ json: {
      categorias: c.categorias, prioridades: [...c.prioridades].sort((a, b) => b.nivel - a.nivel), etapas: c.etapas,
      responsaveis: pessoas.filter((p) => p.responsavel).map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, disponivel: p.disponivel, eu: p.vinculoId === eu.vinculo })),
      pessoas: pessoas.map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, eu: p.vinculoId === eu.vinculo })),
      responsavelPadrao: pessoas.find((p) => p.responsavel && p.disponivel)?.vinculoId ?? null,
      unidades: m.unidades.filter((u) => u.ativa).map((u) => ({ id: u.id, nome: nomeUnidade(u.id) })),
      modelos: c.modelos.filter((x) => x.ativo), regras: c.regrasPedidos,
      pode: { registrar: pode("pedidos.atualizar"), responder: pode("pedidos.responder"), atualizar: pode("pedidos.atualizar"),
        concluir: pode("pedidos.concluir"), revisar: pode("pedidos.revisar") },
      meuVinculo: eu.vinculo,
    } });
  }
  const ct = /^\/v1\/condominio\/pedidos\/contatos\/([^/]+)$/.exec(caminho);
  if (ct) {
    return route.fulfill({ json: m.vinculos.filter((v) => v.unidadeId === ct[1] && v.estado === "CONFIRMADO").map((v) => ({
      contatoId: v.contatoId, nome: m.contatos.find((x) => x.id === v.contatoId)?.nome, relacao: v.relacao, principal: v.principal })) });
  }
  if (caminho === "/v1/condominio/pedidos" && metodo === "GET") {
    const q = url.searchParams;
    const sit = q.get("situacao") ?? "ATIVOS";
    const at = q.get("atencao");
    const resp = q.get("responsavel");
    const busca = (q.get("busca") ?? "").toLowerCase();
    const itens = ped.filter((p) => sit === "TODOS" || (sit === "ATIVOS" ? ["ABERTO", "EM_ANDAMENTO", "EM_REVISAO"].includes(p.estado) : p.estado === sit))
      .filter((p) => !at || (at === "RETORNO_VENCIDO" ? vencido(p, c) : at === "SEM_RESPONSAVEL" ? !p.responsavelId
        : at === "AGUARDANDO_ACEITE" ? !!p.responsavelId && !p.aceitoEm : p.pendencias.some((x) => !x.resolvidaEm)))
      .filter((p) => !resp || (resp === "EU" ? p.responsavelId === eu.vinculo : resp === "NENHUM" ? !p.responsavelId : p.responsavelId === resp))
      .filter((p) => !q.get("prioridade") || p.prioridadeId === q.get("prioridade"))
      .filter((p) => !q.get("categoria") || p.categoriaId === q.get("categoria"))
      .filter((p) => !busca || p.protocolo.includes(busca) || p.assunto.toLowerCase().includes(busca))
      .sort((a, b) => Number(vencido(b, c)) - Number(vencido(a, c))
        || (c.prioridades.find((x) => x.id === b.prioridadeId)!.nivel - c.prioridades.find((x) => x.id === a.prioridadeId)!.nivel));
    return route.fulfill({ json: {
      itens: itens.map((p) => {
        const e = c.etapas.find((x) => x.id === p.etapaId)!;
        const pr = c.prioridades.find((x) => x.id === p.prioridadeId)!;
        return {
          id: p.id, protocolo: p.protocolo, assunto: p.assunto, estado: p.estado, privado: p.privado, unidade: nomeUnidade(p.unidadeId), local: p.local,
          categoria: c.categorias.find((x) => x.id === p.categoriaId)!.nome, prioridade: { nome: pr.nome, nivel: pr.nivel },
          etapa: { nome: e.nome, pausaPrazo: e.pausaPrazo },
          responsavel: p.responsavelId ? { vinculoId: p.responsavelId, nome: nomeVinculo(p.responsavelId), eu: p.responsavelId === eu.vinculo } : null,
          aceito: !!p.aceitoEm, abertoEm: p.abertoEm, encerradoEm: p.encerradoEm, proximoRetorno: p.proximoRetorno, retornoVencido: vencido(p, c),
          previsao: p.previsao, pendencias: p.pendencias.filter((x) => !x.resolvidaEm).length,
        };
      }),
      total: itens.length, pagina: 1, porPagina: 50, resumo: resumoPedidos(ped, c, eu.vinculo), agora: AGORA,
    } });
  }
  if (caminho === "/v1/condominio/pedidos" && metodo === "POST") {
    if (!pode("pedidos.atualizar")) return erro(route, 403, "FORBIDDEN");
    if (String(corpo.assunto ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["assunto"] });
    if (!corpo.unidadeId && !corpo.local) return erro(route, 400, "VALIDATION_ERROR", { campos: ["unidadeId", "local"] });
    const protocolo = `2026-${String(ped.length + 1).padStart(4, "0")}`;
    const p: PedidoFalso = {
      id: novoId(), protocolo, assunto: String(corpo.assunto), descricao: String(corpo.descricao), canal: String(corpo.canal), privado: corpo.privado === true,
      estado: "ABERTO", local: (corpo.local as string) ?? null, versao: 1, unidadeId: (corpo.unidadeId as string) ?? null, contatoId: (corpo.contatoId as string) ?? null,
      categoriaId: String(corpo.categoriaId), prioridadeId: String(corpo.prioridadeId), etapaId: c.etapas.find((e) => e.nome === "Recebido")!.id,
      responsavelId: (corpo.responsavelId as string) ?? null, desde: corpo.responsavelId ? AGORA : null, aceitoEm: corpo.responsavelId === eu.vinculo ? AGORA : null,
      proximoRetorno: depois(24), previsao: null, abertoEm: AGORA, registradoPor: eu.nome, encerradoEm: null, cancelamento: null,
      pendencias: [], andamentos: [], conclusoes: [], historico: [{ acao: "pedido.registrado", em: AGORA, autor: eu.nome, dados: { protocolo, canal: corpo.canal } }],
    };
    const saiu = avisos?.registrar(p, corpo);
    if (saiu && "recusa" in saiu) return erro(route, 400, "VALIDATION_ERROR", { motivo: saiu.recusa });
    if (saiu && "campos" in saiu) return erro(route, 400, "VALIDATION_ERROR", { campos: saiu.campos });
    ped.push(p);
    return route.fulfill({ status: 201, json: { id: p.id, protocolo, versao: 1, ...(saiu ? { avisos: saiu.avisos } : {}) } });
  }

  const ra = /^\/v1\/condominio\/pedidos\/([^/]+)\/arquivos(.*)$/.exec(caminho);
  if (ra) {
    const pa = ped.find((x) => x.id === ra[1]);
    if (!pa) return erro(route, 404, "NOT_FOUND");
    const dele = pa.responsavelId === eu.vinculo;
    return rotasArquivos(route, pa, ra[2]!, metodo, corpo, eu, AGORA, {
      enviar: pode("pedidos.responder") || pode("pedidos.atualizar") || dele, atualizar: pode("pedidos.atualizar"),
    });
  }

  const r = /^\/v1\/condominio\/pedidos\/([^/]+)(\/[a-z-]+)?(?:\/([^/]+)\/resolver)?$/.exec(caminho);
  const p = r ? ped.find((x) => x.id === r[1]) : undefined;
  if (!r || !p) return erro(route, 404, "NOT_FOUND");
  const acao = r[2] ?? "";
  const responsavel = p.responsavelId === eu.vinculo;
  const podeAqui = (a: string) => pode(a) || ((a === "pedidos.responder" || a === "pedidos.atualizar") && responsavel);

  if (metodo === "GET") {
    const e = c.etapas.find((x) => x.id === p.etapaId)!;
    const pr = c.prioridades.find((x) => x.id === p.prioridadeId)!;
    const contato = m.contatos.find((x) => x.id === p.contatoId);
    const doRegistro = avisos?.doPedido(p.id);
    const { pode: podeExtra, ...extra } = detalheExtra?.(p) ?? { pode: {} };
    return route.fulfill({ json: {
      pedido: {
        id: p.id, protocolo: p.protocolo, assunto: p.assunto, descricao: p.descricao, canal: p.canal, privado: p.privado, estado: p.estado, local: p.local, versao: p.versao,
        unidade: p.unidadeId ? { id: p.unidadeId, nome: nomeUnidade(p.unidadeId) } : null,
        contato: contato ? { id: contato.id, nome: contato.nome, telefone: podeAqui("pedidos.responder") ? contato.telefone : undefined, relacao: "MORADOR", dadosRemovidos: false } : null,
        categoria: { id: p.categoriaId, nome: c.categorias.find((x) => x.id === p.categoriaId)!.nome },
        prioridade: { id: pr.id, nome: pr.nome, nivel: pr.nivel, significado: pr.significado },
        etapa: { id: e.id, nome: e.nome, situacao: e.situacao, pausaPrazo: e.pausaPrazo },
        responsavel: p.responsavelId ? { vinculoId: p.responsavelId, nome: nomeVinculo(p.responsavelId), eu: responsavel, desde: p.desde, aceitoEm: p.aceitoEm } : null,
        proximoRetorno: p.proximoRetorno, retornoVencido: vencido(p, c), previsao: p.previsao, abertoEm: p.abertoEm, registradoPor: p.registradoPor,
        encerradoEm: p.encerradoEm, cancelamento: p.cancelamento, prestador: doRegistro?.prestador,
      },
      avisosRegistro: doRegistro?.avisos ?? [],
      pendencias: p.pendencias.map((x) => ({ ...x, responsavel: { vinculoId: x.responsavelId, nome: nomeVinculo(x.responsavelId), ativo: true } })),
      andamentos: [...p.andamentos].reverse(),
      conclusoes: [...p.conclusoes].reverse(),
      historico: p.historico,
      pode: { responder: podeAqui("pedidos.responder"), atualizar: podeAqui("pedidos.atualizar"), concluir: pode("pedidos.concluir"), revisar: pode("pedidos.revisar"),
        aceitar: responsavel && !p.aceitoEm && !["ENCERRADO", "CANCELADO"].includes(p.estado), repassar: pode("pedidos.atualizar") || responsavel, ...podeExtra },
      regras: c.regrasPedidos, agora: AGORA, ...extra,
    } });
  }

  if (corpo.versao !== p.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: p.versao, atual: { id: p.id } });
  const ok = () => { p.versao++; return route.fulfill({ json: { versao: p.versao } }); };
  const exige = (a: string) => (podeAqui(a) ? null : erro(route, 403, "FORBIDDEN"));
  const texto = (k: string) => String(corpo[k] ?? "").trim();

  switch (acao) {
    case "/aceitar":
      if (!responsavel) return erro(route, 400, "VALIDATION_ERROR", { motivo: "NAO_RESPONSAVEL" });
      p.aceitoEm = AGORA; hist(p, "pedido.aceito"); return ok();
    case "/retornos": {
      const x = exige("pedidos.responder"); if (x) return x;
      if (texto("texto").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
      p.andamentos.push({ id: novoId(), tipo: "RETORNO", meio: String(corpo.meio), texto: texto("texto"), em: AGORA, autor: eu.nome });
      hist(p, "pedido.retorno_registrado", { meio: corpo.meio, de: p.proximoRetorno, para: depois(24) });
      p.proximoRetorno = depois(24); return ok();
    }
    case "/notas":
      p.andamentos.push({ id: novoId(), tipo: "NOTA", meio: null, texto: texto("texto"), em: AGORA, autor: eu.nome }); hist(p, "pedido.nota"); return ok();
    case "/previsao": {
      const x = exige("pedidos.atualizar"); if (x) return x;
      if (p.previsao && texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      hist(p, "pedido.previsao_mudou", { de: p.previsao, para: corpo.data, motivo: corpo.motivo });
      p.previsao = (corpo.data as string) ?? null; return ok();
    }
    case "/proximo-retorno":
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      hist(p, "pedido.retorno_mudou", { de: p.proximoRetorno, para: corpo.quando, motivo: corpo.motivo });
      p.proximoRetorno = String(corpo.quando); return ok();
    case "/pendencias": {
      if (r[3]) {
        const pend = p.pendencias.find((x) => x.id === r[3]);
        if (!pend) return erro(route, 404, "NOT_FOUND");
        pend.resolvidaEm = AGORA; pend.resolvidaPor = eu.nome; pend.resolucao = texto("resolucao");
        hist(p, "pedido.pendencia_resolvida", { tipo: pend.tipo }); return ok();
      }
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      p.pendencias.push({ id: novoId(), tipo: String(corpo.tipo), motivo: texto("motivo"), responsavelId: String(corpo.responsavelId), abertaEm: AGORA, abertaPor: eu.nome,
        resolvidaEm: null, resolvidaPor: null, resolucao: null });
      hist(p, "pedido.pendencia_aberta", { tipo: corpo.tipo }); return ok();
    }
    case "/responsavel":
      if (!disponivel(corpo.responsavelId)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "RESPONSAVEL_INDISPONIVEL" });
      hist(p, "pedido.responsavel", { de: p.responsavelId, para: corpo.responsavelId, deNome: nomeVinculo(p.responsavelId), paraNome: nomeVinculo(corpo.responsavelId as string),
        motivo: corpo.motivo ?? undefined });
      p.responsavelId = String(corpo.responsavelId); p.desde = AGORA; p.aceitoEm = p.responsavelId === eu.vinculo ? AGORA : null; return ok();
    case "/etapa": {
      const e = c.etapas.find((x) => x.id === corpo.etapaId)!;
      hist(p, "pedido.alterado", { campo: "etapa", de: c.etapas.find((x) => x.id === p.etapaId)!.nome, para: e.nome });
      if (e.situacao !== p.estado) estado(p, e.situacao, "ETAPA_MUDOU");
      p.etapaId = e.id; return ok();
    }
    case "/concluir": {
      if (!pode("pedidos.concluir")) return erro(route, 403, "FORBIDDEN");
      if (texto("explicacao").length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["explicacao"] });
      if (p.pendencias.some((x) => !x.resolvidaEm)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PENDENCIA_ABERTA" });
      const revisa = c.regrasPedidos.revisao && !pode("pedidos.revisar");
      p.conclusoes.push({ id: novoId(), etapa: c.etapas.find((x) => x.id === corpo.etapaId)!.nome, etapaAnterior: p.etapaId, explicacao: texto("explicacao"),
        evidencia: (corpo.evidencia as string) ?? null, concluidaEm: AGORA, concluidaPor: eu.nome,
        revisao: !c.regrasPedidos.revisao ? "SEM_REVISAO" : revisa ? "AGUARDANDO" : "APROVADA", revisadaEm: null, revisadaPor: null, motivoDevolucao: null,
        reabertaEm: null, reabertaPor: null, motivoReabertura: null });
      estado(p, revisa ? "EM_REVISAO" : "ENCERRADO", "CONCLUIDO");
      p.etapaId = String(corpo.etapaId); p.proximoRetorno = null; p.encerradoEm = revisa ? null : AGORA;
      p.versao++; return route.fulfill({ json: { versao: p.versao, estado: p.estado } });
    }
    case "/reabrir": {
      if (!c.regrasPedidos.reabertura) return erro(route, 400, "VALIDATION_ERROR", { motivo: "REABERTURA_DESLIGADA" });
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      const cl = p.conclusoes[p.conclusoes.length - 1]!;
      cl.reabertaEm = AGORA; cl.reabertaPor = eu.nome; cl.motivoReabertura = texto("motivo");
      estado(p, "EM_ANDAMENTO", "REABERTO", texto("motivo"));
      p.etapaId = c.etapas.find((e) => e.nome === "Em análise")!.id; p.encerradoEm = null; p.proximoRetorno = depois(24); return ok();
    }
    case "/cancelar":
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      estado(p, "CANCELADO", "CANCELADO", texto("motivo"));
      p.cancelamento = { em: AGORA, motivo: texto("motivo"), por: eu.nome }; p.proximoRetorno = null; return ok();
    case "": {
      hist(p, "pedido.alterado", { campo: "prioridade", de: c.prioridades.find((x) => x.id === p.prioridadeId)!.nome, para: c.prioridades.find((x) => x.id === corpo.prioridadeId)!.nome });
      p.categoriaId = String(corpo.categoriaId); p.prioridadeId = String(corpo.prioridadeId); p.local = (corpo.local as string) ?? null; p.privado = corpo.privado === true;
      return ok();
    }
    default:
      return erro(route, 404, "NOT_FOUND");
  }
}

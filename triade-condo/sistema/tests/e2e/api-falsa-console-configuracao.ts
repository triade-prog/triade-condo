// Aba Configuração do Console na API falsa (PI-04, CF-01, CF-09, CF-12; desenho "Configuração na
// implantação"). As regras de verdade estão no banco (pgTAP 032) e na API (Deno); aqui só o
// bastante para a tela: as 11 partes, conferir, e os ajustes da TRÍADE com motivo no cliente ativo.
import type { Route } from "@playwright/test";

/** As 11 partes, na ordem do app (PARTES_CONFIGURACAO do domínio). */
const PARTES = ["HORARIOS", "FERIADOS", "AREAS", "CATEGORIAS", "ETAPAS", "MODELOS", "PRAZOS", "MANUTENCAO", "COMUNICADOS", "ETIQUETAS", "WHATSAPP"] as const;
type ParteConfiguracao = (typeof PARTES)[number];

let n = 0;
const novoId = () => `4b5c6d7e-8f9a-4b0c-9d1e-${String(++n).padStart(12, "0")}`;
const agora = () => new Date().toISOString();

export function criarConfiguracaoConsole() {
  const etapa = (nome: string, situacao: string, ordem: number, pausaPrazo = false) =>
    ({ id: novoId(), nome, situacao, categoriaId: null as string | null, pausaPrazo, ordem, ativa: true, versao: 1 });
  return {
    /** Conferidas na semente: todas menos o WhatsApp. */
    conferencias: new Map<ParteConfiguracao, { em: string; por: string; nota?: string }>(
      PARTES.filter((p) => p !== "WHATSAPP").map((p) => [p, { em: "2026-10-19T15:00:00Z", por: "Carolina" }])),
    mudancas: new Map<ParteConfiguracao, { em: string; por: string; equipe: boolean }>(),
    /** Avisos que o banco mandaria ao síndico no sino (tipo CONFIGURACAO). */
    avisosSindico: [] as { texto: string; motivo: string }[],
    config: {
      fuso: "America/Sao_Paulo",
      versao: 1,
      horarios: {
        FUNCIONAMENTO: { intervalos: [] as { dia: number; inicio: string; fim: string }[], versao: 1 },
        ATENDIMENTO: { intervalos: [{ dia: 1, inicio: "08:00", fim: "18:00" }], versao: 1 },
      },
      feriados: [] as { id: string; data: string; descricao: string }[],
      categorias: [{ id: novoId(), nome: "Manutenção", ativa: true, versao: 1 }],
      prioridades: [{ id: novoId(), nome: "Normal", significado: "No prazo de costume.", nivel: 1, ativa: true, versao: 1 }],
      etapas: [etapa("Recebido", "ABERTO", 1), etapa("Em análise", "EM_ANDAMENTO", 1), etapa("Concluído", "ENCERRADO", 1)],
      modelos: [] as { id: string; titulo: string; texto: string; categoriaId: string | null; ativo: boolean; versao: number }[],
      prazos: [{ id: novoId(), categoriaId: null as string | null, prioridadeId: null as string | null, horas: 24, versao: 1 }],
      regrasPedidos: { revisao: false, reabertura: true },
      avisos: { sindicoHoras: 24, substitutoHoras: 48, substitutoId: null, semResponsavelHoras: 4, pendenciaDias: 3, substitutosPossiveis: [] },
      avisoNovo: { sindico: "SEMPRE", protocolo: true, podeMudar: false },
      parecidosDias: 90,
      pendencias: [] as string[],
    },
  };
}
export type EstadoConfiguracaoConsole = ReturnType<typeof criarConfiguracaoConsole>;

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** Andamento que o roteiro mostra na etapa 4. */
export function andamentoConfiguracao(est: EstadoConfiguracaoConsole) {
  const partes = situacao(est);
  return { conferidas: partes.filter((p) => p.conferida).length, total: partes.length, faltando: partes.filter((p) => !p.conferida).map((p) => p.parte) };
}

function situacao(est: EstadoConfiguracaoConsole) {
  return PARTES.map((parte) => {
    const conferencia = est.conferencias.get(parte);
    const mudanca = est.mudancas.get(parte);
    return { parte, conferida: !!conferencia && (!mudanca || mudanca.em <= conferencia.em), ...(conferencia ? { conferencia } : {}), ...(mudanca ? { mudanca } : {}) };
  });
}

/** Atende /v1/clientes/:id/configuracao e /v1/clientes/:id/condominio/*; devolve null quando a rota não é daqui. */
export async function rotasConfiguracaoConsole(route: Route, est: EstadoConfiguracaoConsole, resto: string, metodo: string,
  corpo: Record<string, unknown>, cliente: { estagio: () => string; equipe: string }): Promise<unknown> {
  const emImplantacao = () => cliente.estagio() !== "ATIVO";
  const c = est.config;
  const mudou = (parte: ParteConfiguracao) => est.mudancas.set(parte, { em: agora(), por: cliente.equipe, equipe: true });
  /** Ajuste da TRÍADE: com o cliente ativo, o motivo é obrigatório e vai no aviso ao síndico. */
  const semMotivo = (texto: string) => {
    if (emImplantacao()) return null;
    const motivo = String(corpo.motivo ?? "").trim();
    if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    est.avisosSindico.push({ texto, motivo });
    return null;
  };

  if (resto === "/configuracao") {
    return route.fulfill({ json: {
      estagio: cliente.estagio(), emImplantacao: emImplantacao(), partes: situacao(est),
      sindico: { termoAceito: false, revisao: c.regrasPedidos.revisao, reabertura: c.regrasPedidos.reabertura, avisosLigados: 0, pessoas: 1 },
      ajustes: { fuso: c.fuso, parecidosDias: c.parecidosDias, anexarMinutos: 30, versao: c.versao },
      pode: { conferir: emImplantacao(), montar: emImplantacao(), tecnica: true },
      motivoObrigatorio: !emImplantacao(),
    } });
  }
  if (resto === "/configuracao/conferir" && metodo === "POST") {
    if (!emImplantacao()) return erro(route, 422, "VALIDATION_ERROR", { motivo: "IMPLANTACAO_ENTREGUE" });
    est.conferencias.set(corpo.parte as ParteConfiguracao, { em: agora(), por: cliente.equipe, ...(corpo.nota ? { nota: String(corpo.nota) } : {}) });
    const a = andamentoConfiguracao(est);
    return route.fulfill({ json: { conferidas: a.conferidas, total: a.total } });
  }
  if (!resto.startsWith("/condominio/")) return null;
  const caminho = resto.slice("/condominio".length);

  if (caminho === "/configuracoes") {
    return route.fulfill({ json: { ...c, podeEditar: emImplantacao(), tecnica: { pode: true, motivo: !emImplantacao() } } });
  }
  if (caminho === "/fuso" && metodo === "PUT") {
    if (corpo.versao !== c.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: c.versao });
    const falta = semMotivo("Fuso"); if (falta) return falta;
    c.fuso = String(corpo.fuso); c.versao++;
    mudou("HORARIOS");
    return route.fulfill({ json: { versao: c.versao } });
  }
  if (caminho === "/etapas" && metodo === "POST") {
    const falta = semMotivo("Etapas dos pedidos"); if (falta) return falta;
    const e = { id: novoId(), nome: String(corpo.nome), situacao: String(corpo.situacao), categoriaId: (corpo.categoriaId as string) || null,
      pausaPrazo: corpo.pausaPrazo === true, ordem: 9, ativa: true, versao: 1 };
    c.etapas.push(e);
    mudou("ETAPAS");
    return route.fulfill({ status: 201, json: { id: e.id, versao: 1 } });
  }
  if (caminho === "/areas-comuns") return route.fulfill({ json: { areas: [], podeEditar: emImplantacao() } });
  return erro(route, 404, "NOT_FOUND");
}

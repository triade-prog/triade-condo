// Vida em condomínio (peça R12; AC-01 a AC-07). Os mesmos valores estão no banco
// (0220_vida_reservas.sql). As datas chegam como "AAAA-MM-DD" e as horas como "HH:MM", no fuso
// do condomínio.

import { z } from "zod";

/** Como a reserva da área é confirmada (decisão 4). */
export const CONFIRMACOES_AREA = {
  SINDICO: "O síndico aprova",
  AUTOMATICA: "Automática",
  SEM_RESERVA: "Uso livre, sem reserva",
} as const;
export type ConfirmacaoArea = keyof typeof CONFIRMACOES_AREA;

export const MODOS_AREA = { PERIODO: "Período inteiro", BLOCOS: "Em blocos de horas" } as const;
export type ModoArea = keyof typeof MODOS_AREA;

export const PERIODOS_LIMITE = { SEMANA: "por semana", MES: "por mês" } as const;
export type PeriodoLimite = keyof typeof PERIODOS_LIMITE;

export const BLOCOS_MINUTOS = [30, 60, 90, 120, 180, 240] as const;

export const ESTADOS_RESERVA = {
  A_APROVAR: "A aprovar",
  CONFIRMADA: "Confirmada",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
} as const;
export type EstadoReserva = keyof typeof ESTADOS_RESERVA;

export const FILTROS_RESERVA = { A_APROVAR: "A aprovar", PROXIMAS: "Próximas", TODAS: "Todas" } as const;
export type FiltroReserva = keyof typeof FILTROS_RESERVA;

/** As abas da Vida em condomínio, com a ação que deixa ver cada uma (decisão 1). */
export const ABAS_VIDA = { reservas: "Reservas", enquetes: "Enquetes", assembleias: "Assembleias", classificados: "Classificados" } as const;
export type AbaVida = keyof typeof ABAS_VIDA;

/** Quem responde a enquete (AC-03): uma resposta por unidade ou por pessoa com vínculo confirmado. */
export const ESCOPOS_ENQUETE = { UNIDADE: "Uma por unidade", PESSOA: "Uma por pessoa" } as const;
export type EscopoEnquete = keyof typeof ESCOPOS_ENQUETE;

/** Por onde a enquete chega (AC-03). */
export const CANAIS_ENQUETE = { WHATSAPP: "WhatsApp", MURAL: "Mural", EMAIL: "E-mail" } as const;
export type CanalEnquete = keyof typeof CANAIS_ENQUETE;

export const SITUACOES_ENQUETE = { ABERTA: "Aberta", ENCERRADA: "Encerrada" } as const;
export type SituacaoEnquete = keyof typeof SITUACOES_ENQUETE;

/** Assembleias (AC-02; 0240_vida_assembleias.sql). */
export const TIPOS_ASSEMBLEIA = { ORDINARIA: "Ordinária", EXTRAORDINARIA: "Extraordinária" } as const;
export type TipoAssembleia = keyof typeof TIPOS_ASSEMBLEIA;

export const FORMAS_ASSEMBLEIA = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDA: "Híbrida" } as const;
export type FormaAssembleia = keyof typeof FORMAS_ASSEMBLEIA;

export const ESTADOS_ASSEMBLEIA = {
  RASCUNHO: "Rascunho",
  CONVOCADA: "Convocada",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
} as const;
export type EstadoAssembleia = keyof typeof ESTADOS_ASSEMBLEIA;

/** Como o voto pesa (decisão 9). */
export const PESOS_ASSEMBLEIA = { FRACAO: "Pela fração ideal", UNIDADE: "Um voto por unidade" } as const;
export type PesoAssembleia = keyof typeof PESOS_ASSEMBLEIA;

export const TIPOS_ITEM = { APROVACAO: "Aprovar ou não (Sim, Não, Abstenção)", ESCOLHA: "Escolher entre opções" } as const;
export type TipoItem = keyof typeof TIPOS_ITEM;

/** Os quóruns comuns; a convenção de cada prédio é que manda (decisão 9). */
export const QUORUNS = {
  MAIORIA_PRESENTES: "Maioria dos presentes",
  MAIORIA_TODAS: "Maioria de todas as frações",
  DOIS_TERCOS_TODAS: "Dois terços de todas as frações",
  UNANIMIDADE: "Unanimidade",
} as const;
export type Quorum = keyof typeof QUORUNS;

export const ESTADOS_ITEM = { AGUARDANDO: "Aguardando", ABERTO: "Em votação", ENCERRADO: "Votado" } as const;
export type EstadoItem = keyof typeof ESTADOS_ITEM;

export const SITUACOES_ITEM = {
  APROVADO: "Aprovado",
  REPROVADO: "Não aprovado",
  ESCOLHIDA: "Escolhida",
  EMPATE: "Empate",
  SEM_QUORUM: "Sem quórum",
  SEM_VOTOS: "Sem votos",
} as const;
export type SituacaoItem = keyof typeof SITUACOES_ITEM;

// Classificados entre moradores (AC-05): o tipo escolhido no WhatsApp e o estado do anúncio.
export const TIPOS_ANUNCIO = { VENDO: "Vendo", DOO: "Doação", PROCURO: "Procuro", SERVICO: "Serviço de morador" } as const;
export type TipoAnuncio = keyof typeof TIPOS_ANUNCIO;

export const ESTADOS_ANUNCIO = {
  A_APROVAR: "A aprovar",
  NO_MURAL: "No mural",
  RECUSADO: "Recusado",
  RETIRADO: "Tirado do mural",
  VENCIDO: "Venceu",
} as const;
export type EstadoAnuncio = keyof typeof ESTADOS_ANUNCIO;

export const FILTROS_ANUNCIO = { A_APROVAR: "A aprovar", NO_MURAL: "No mural", ENCERRADOS: "Encerrados" } as const;
export type FiltroAnuncio = keyof typeof FILTROS_ANUNCIO;

/** O aviso do mural (decisão 14). */
export const AVISO_CLASSIFICADOS = "Anúncios de moradores, aprovados pelo condomínio. O condomínio não vende nem garante nada daqui.";

export const ESTADOS_PROCURACAO = { PENDENTE: "A conferir", ACEITA: "Aceita", RECUSADA: "Recusada" } as const;
export type EstadoProcuracao = keyof typeof ESTADOS_PROCURACAO;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const horaFim = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/);
const uuid = z.string().uuid();
const versao = z.number().int().min(1);
const opcional = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) => opcional(z.string().max(max)).transform((v) => (v && v.trim() ? v.trim() : null));

/** Criar ou ajustar uma área comum (AC-07). */
export const areaSchema = z
  .object({
    versao: opcional(versao),
    nome: z.string().trim().min(2).max(60),
    ativa: z.boolean().default(false),
    reserva: z.enum(chaves(CONFIRMACOES_AREA)),
    antecedenciaMin: z.number().int().min(0).max(365).default(1),
    antecedenciaMax: z.number().int().min(1).max(730).default(30),
    horaInicio: hora,
    horaFim,
    modo: z.enum(chaves(MODOS_AREA)).default("PERIODO"),
    blocoMinutos: opcional(z.number().int().refine((v) => (BLOCOS_MINUTOS as readonly number[]).includes(v))),
    capacidade: opcional(z.number().int().min(1).max(2000)),
    limiteQuantidade: opcional(z.number().int().min(1).max(31)),
    limitePeriodo: opcional(z.enum(chaves(PERIODOS_LIMITE))),
    toleranciaDias: opcional(z.number().int().min(1).max(60)),
    cancelarSemAvisoDias: z.number().int().min(0).max(60).default(3),
    valorCentavos: opcional(z.number().int().min(0).max(10_000_000)),
    regrasDocumentoId: opcional(uuid),
    podeProprietarioMorador: z.boolean().default(true),
    podeInquilino: z.boolean().default(true),
    podeProprietarioAusente: z.boolean().default(false),
  })
  .superRefine((a, ctx) => {
    if (a.horaFim <= a.horaInicio) ctx.addIssue({ code: "custom", path: ["horaFim"], message: "O fim vem depois do início" });
    if (a.antecedenciaMin > a.antecedenciaMax) ctx.addIssue({ code: "custom", path: ["antecedenciaMax"], message: "O máximo vem depois do mínimo" });
    if (a.modo === "BLOCOS" && !a.blocoMinutos) ctx.addIssue({ code: "custom", path: ["blocoMinutos"], message: "Escolha o tamanho do bloco" });
    if (a.limiteQuantidade && !a.limitePeriodo) ctx.addIssue({ code: "custom", path: ["limiteQuantidade"], message: "Escolha semana ou mês" });
    if (a.toleranciaDias && !a.limiteQuantidade) ctx.addIssue({ code: "custom", path: ["toleranciaDias"], message: "A tolerância vale com limite" });
    if (a.ativa && a.reserva !== "SEM_RESERVA" && !(a.podeProprietarioMorador || a.podeInquilino || a.podeProprietarioAusente)) {
      ctx.addIssue({ code: "custom", path: ["podeProprietarioMorador"], message: "Escolha quem pode reservar" });
    }
  });
export type AreaComum = z.infer<typeof areaSchema>;

/** Registrar a reserva pedida por telefone (decisão 1). */
export const registrarReservaSchema = z.object({
  areaId: uuid,
  unidadeId: uuid,
  contatoId: opcional(uuid),
  data,
  horaInicio: opcional(hora),
  observacao: texto(300),
});

export const aprovarReservaSchema = z.object({ versao, recado: texto(300) });
export const motivoReservaSchema = z.object({ versao, motivo: z.string().trim().min(3).max(500) });

export const filtroReservasSchema = z.object({
  filtro: z.enum(chaves(FILTROS_RESERVA)).default("A_APROVAR"),
  areaId: opcional(uuid),
});
export const semanaAreaSchema = z.object({ de: data });
export const conferirReservaSchema = z.object({ areaId: uuid, unidadeId: opcional(uuid), data });

/** Criar a enquete (AC-03). O prazo vai de 1 hora a 90 dias; o banco confere com o relógio dele. */
export const criarEnqueteSchema = z
  .object({
    pergunta: z.string().trim().min(5).max(200),
    opcoes: z.array(z.string().trim().max(80)).max(6).transform((o) => o.filter((x) => x !== "")),
    por: z.enum(chaves(ESCOPOS_ENQUETE)),
    secreta: z.boolean(),
    abertaAte: z.string().datetime({ offset: true }),
    canais: z.array(z.enum(chaves(CANAIS_ENQUETE))).min(1).max(3).transform((c) => [...new Set(c)]),
  })
  .superRefine((e, ctx) => {
    if (e.opcoes.length < 2) ctx.addIssue({ code: "custom", path: ["opcoes"], message: "Pelo menos duas opções" });
    if (new Set(e.opcoes.map((o) => o.toLowerCase())).size !== e.opcoes.length) {
      ctx.addIssue({ code: "custom", path: ["opcoes"], message: "As opções são diferentes entre si" });
    }
  });
export type NovaEnquete = z.infer<typeof criarEnqueteSchema>;

export const versaoEnqueteSchema = z.object({ versao });
export const linkEnqueteSchema = z.object({ conviteId: uuid });
export const responderEnqueteSchema = z.object({ opcao: z.number().int().min(1).max(6) });

const itemPautaSchema = z.object({
  titulo: z.string().trim().max(200),
  descricao: z.string().trim().max(1000).optional(),
  tipo: z.enum(chaves(TIPOS_ITEM)),
  opcoes: z.array(z.string().trim().max(80)).max(10).optional(),
  quorum: z.enum(chaves(QUORUNS)),
});

/** O rascunho da assembleia e a pauta (AC-02). O banco confere datas, pauta e opções. */
export const salvarAssembleiaSchema = z.object({
  versao: opcional(versao),
  titulo: z.string().trim().min(5).max(120),
  tipo: z.enum(chaves(TIPOS_ASSEMBLEIA)),
  forma: z.enum(chaves(FORMAS_ASSEMBLEIA)),
  primeiraChamada: z.string().datetime({ offset: true }),
  segundaChamada: z.string().datetime({ offset: true }),
  local: z.string().trim().max(200).optional(),
  linkVideo: z.string().trim().max(300).optional(),
  itens: z.array(itemPautaSchema).min(1).max(30),
});
export type DadosAssembleia = z.infer<typeof salvarAssembleiaSchema>;

export const versaoAssembleiaSchema = z.object({ versao });
export const cancelarAssembleiaSchema = z.object({ versao, motivo: z.string().trim().min(3).max(500) });
export const itemAssembleiaSchema = z.object({ itemId: uuid });
export const presencaAssembleiaSchema = z.object({ conviteId: uuid, presente: z.boolean() });
export const direitoVotoSchema = z.object({ conviteId: uuid, semDireito: z.boolean(), motivo: z.string().trim().max(300).optional() });
export const procuracaoSchema = z.object({ conviteId: uuid, aceitar: z.boolean(), motivo: z.string().trim().max(300).optional() });
export const registrarVotoSchema = z.object({ conviteId: uuid, itemId: uuid, opcao: z.number().int().min(1).max(11) });
export const ataAssembleiaSchema = z.object({ versao, texto: z.string().max(20000).optional(), documentoId: opcional(uuid) });
export const linkAssembleiaSchema = z.object({ conviteId: uuid });
export const regrasAssembleiaSchema = z.object({ versao, antecedencia: z.number().int().min(1).max(60), peso: z.enum(chaves(PESOS_ASSEMBLEIA)) });
export const fracoesSchema = z.object({
  fracoes: z.array(z.object({ unidadeId: uuid, fracao: z.number().gt(0).max(100).nullable(), versao })).max(2000),
});
export const votarAssembleiaSchema = z.object({ itemId: uuid, opcao: z.number().int().min(1).max(11) });
export const publicarAnuncioSchema = z.object({
  versao,
  titulo: z.string().trim().min(3).max(80),
  valorCentavos: opcional(z.number().int().min(1).max(100000000)),
});
export const recusarAnuncioSchema = z.object({ versao, motivo: z.string().trim().min(3).max(500) });
export const tirarAnuncioSchema = z.object({ versao, motivo: texto(500) });

export const procuracaoPublicaSchema = z.object({ nome: z.string().trim().min(3).max(120).nullable(), unidadeId: opcional(uuid) });

// ---------------------------------------------------------------------------------------
// Textos das telas.

/** "10h", "8h30", "24h". */
export function horaCurta(h: string): string {
  const [hh, mm] = h.split(":");
  return `${Number(hh)}h${mm && mm !== "00" ? mm : ""}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "R$ 150,00". */
export function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "1 hora", "2 horas", "30 minutos", "1h30". */
export function duracaoBloco(min: number): string {
  if (min % 60 === 0) return min === 60 ? "1 hora" : `${min / 60} horas`;
  return min < 60 ? `${min} minutos` : `${Math.floor(min / 60)}h${min % 60}`;
}

type AreaResumo = Pick<AreaComum, "reserva" | "antecedenciaMin" | "antecedenciaMax" | "horaInicio" | "horaFim" | "modo"> & {
  blocoMinutos?: number | null;
  capacidade?: number | null;
  limiteQuantidade?: number | null;
  limitePeriodo?: PeriodoLimite | null;
  toleranciaDias?: number | null;
  criadaPeloSindico?: boolean;
};

/** A linha da área na lista (AC-07): "Síndico aprova · 2 a 60 dias de antecedência · 10h às 23h · até 80 pessoas · 1 por mês por unidade". */
export function descreverArea(a: AreaResumo): string {
  const horas = `${horaCurta(a.horaInicio)} às ${horaCurta(a.horaFim)}`;
  if (a.reserva === "SEM_RESERVA") return `Uso livre, sem reserva · ${horas}`;
  const partes = [
    a.criadaPeloSindico ? "Criada pelo síndico" : null,
    a.reserva === "SINDICO" ? "Síndico aprova" : "Automática",
    a.antecedenciaMin > 0 ? `${a.antecedenciaMin} a ${a.antecedenciaMax} dias de antecedência` : `até ${a.antecedenciaMax} ${a.antecedenciaMax === 1 ? "dia" : "dias"}`,
    a.modo === "BLOCOS" && a.blocoMinutos ? `blocos de ${duracaoBloco(a.blocoMinutos)}, ${horas}` : horas,
    a.capacidade ? `até ${a.capacidade} pessoas` : null,
    a.limiteQuantidade && a.limitePeriodo
      ? `${a.limiteQuantidade} ${PERIODOS_LIMITE[a.limitePeriodo]} por unidade${a.toleranciaDias ? ", +1 se sobrar" : ""}`
      : null,
  ];
  return partes.filter(Boolean).join(" · ");
}

/** O período do limite em palavras: "em outubro" ou "na semana". */
export function periodoDoLimite(periodo: PeriodoLimite, dataIso: string): string {
  return periodo === "MES" ? `em ${MESES[Number(dataIso.slice(5, 7)) - 1]}` : "na semana";
}

/** "2ª reserva da unidade em outubro (limite 2)". Passou do limite: "3ª no mês, pela tolerância". */
export function textoLimite(l: { n: number; quantidade: number; periodo: PeriodoLimite }, dataIso: string, tolerancia: boolean): string {
  if (tolerancia) return `${l.n}ª ${periodoDoLimite(l.periodo, dataIso)}, aceita porque a data estava livre perto do dia`;
  return `${l.n}ª reserva da unidade ${periodoDoLimite(l.periodo, dataIso)} (limite ${l.quantidade})`;
}

/** Os eventos da reserva no histórico. */
export function descreverEventoReserva(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "reserva.registrada":
      return d.origem === "WHATSAPP" ? "Pedida pelo WhatsApp" : "Registrada pelo painel";
    case "estado.mudou":
      switch (d.para) {
        case "A_APROVAR": return "Esperando aprovação";
        case "CONFIRMADA": return d.de ? "Aprovada" : "Confirmada na hora";
        case "RECUSADA": return "Recusada";
        case "CANCELADA": return d.evento === "CANCELADA_PELO_MORADOR" ? "Cancelada pelo morador" : "Cancelada";
        default: return "Situação mudou";
      }
    default:
      return "Alteração";
  }
}

/** Os eventos da enquete no histórico. */
export function descreverEventoEnquete(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "enquete.criada": {
      const n = Number(d.convites ?? 0);
      return `Enviada para ${n} ${n === 1 ? "convite" : "convites"}`;
    }
    case "enquete.lembrete": return "Lembrete enviado a quem faltava";
    case "enquete.link_gerado": return `Link copiado para ${String(d.para ?? "um convite")}`;
    case "enquete.encerrada": return d.pelo === "PRAZO" ? "Fechou no prazo" : "Encerrada antes do prazo";
    case "enquete.resultado_publicado": return "Resultado levado a Comunicados";
    default: return "Alteração";
  }
}

/** "3 de 12 responderam" ou "ninguém respondeu ainda". */
export function textoRespostas(responderam: number, total: number): string {
  if (responderam === 0) return total ? `Ninguém respondeu ainda, de ${total}` : "Ninguém para responder";
  return `${responderam} de ${total} ${responderam === 1 ? "respondeu" : "responderam"}`;
}

/** A porcentagem de cada opção, arredondada, sobre quem respondeu. */
export function porcentagem(votos: number, total: number): number {
  return total > 0 ? Math.round((100 * votos) / total) : 0;
}

/** Os eventos da assembleia no histórico. */
export function descreverEventoAssembleia(acao: string, d: Record<string, unknown>): string {
  const u = String(d.unidade ?? "uma unidade");
  switch (acao) {
    case "assembleia.criada": return "Rascunho criado";
    case "assembleia.convocada": return `Convocada: edital publicado e ${Number(d.unidades ?? 0)} unidades convidadas`;
    case "assembleia.lembrete": return "Lembrete enviado na véspera";
    case "assembleia.cancelada": return `Cancelada: ${String(d.motivo ?? "")}`;
    case "assembleia.iniciada": return "Assembleia começou";
    case "assembleia.item_aberto": return `Item ${Number(d.item)} em votação`;
    case "assembleia.item_encerrado": {
      const s = SITUACOES_ITEM[d.situacao as SituacaoItem] ?? "votado";
      return `Item ${Number(d.item)} votado: ${d.vencedor ? `${s.toLowerCase()} ${String(d.vencedor)}` : s.toLowerCase()}`;
    }
    case "assembleia.presenca": return `Presença no salão: ${u}`;
    case "assembleia.presenca_retirada": return `Presença retirada: ${u}`;
    case "assembleia.sem_direito": return `Sem direito a voto: ${u} (${String(d.motivo ?? "")})`;
    case "assembleia.direito_devolvido": return `Direito a voto devolvido: ${u}`;
    case "assembleia.procuracao_indicada": return `Procuração indicada por ${u}: ${String(d.procurador ?? "")}`;
    case "assembleia.procuracao_retirada": return `Procuração retirada por ${u}`;
    case "assembleia.procuracao_aceita": return `Procuração de ${u} aceita`;
    case "assembleia.procuracao_recusada": return `Procuração de ${u} recusada: ${String(d.motivo ?? "")}`;
    case "assembleia.link_gerado": return `Link copiado para ${u}`;
    case "assembleia.encerrada": return "Assembleia encerrada";
    case "assembleia.ata_ligada": return `Ata ligada: ${String(d.documento ?? "")}`;
    default: return "Alteração";
  }
}

/** "62,5%" (uma casa, vírgula). */
export function porcento(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** O quórum de todas as frações não dá com quem está presente: avisa antes de votar. */
export function avisoQuorum(quorum: Quorum, alcancavel: boolean): string | null {
  if (alcancavel || quorum === "MAIORIA_PRESENTES") return null;
  return `Os presentes não alcançam ${QUORUNS[quorum].toLowerCase()}: mesmo com todos a favor, o item não passa.`;
}

/** Em qual filtro da aba o anúncio aparece. */
export function filtroDoAnuncio(estado: EstadoAnuncio): FiltroAnuncio {
  return estado === "A_APROVAR" ? "A_APROVAR" : estado === "NO_MURAL" ? "NO_MURAL" : "ENCERRADOS";
}

/** "R$ 900" vira 90000; vazio, nada; inválido, undefined. */
export function centavosDoTexto(v: string): number | null | undefined {
  const t = v.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return undefined;
  const n = Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100);
  return n >= 1 && n <= 100000000 ? n : undefined;
}

// A agenda de demonstrações nas telas (0310, R17.6; CM-23, quadros 340 e 341): os tipos que a
// api-console devolve, as rotas, os horários livres em texto (e de volta), o selo de cada
// demonstração e o horário de Brasília. A grade, quem está livre e a trava do mesmo horário são do
// banco; aqui só se mostra e se monta o pedido.

import {
  DIAS_SEMANA_AGENDA, quandoDemonstracao, SITUACOES_DEMONSTRACAO, SITUACOES_EMAIL_COMERCIAL, type EtapaComercial, type SituacaoDemonstracao, type SituacaoEmailComercial,
} from "@triade/domain";
import type { Tom } from "@triade/ui";

export interface PessoaAgenda { id: string; nome: string }

export interface Demonstracao {
  id: string;
  versao: number;
  inicio: string;
  fim: string;
  quando: string;
  situacao: SituacaoDemonstracao;
  origem: "LINK" | "MAO";
  remarcacoes: number;
  motivo?: string;
  interessado: { id: string; versao: number; condominio: string; etapa: EtapaComercial; pessoa?: string; temEmail: boolean };
  com: PessoaAgenda;
  confirmacao?: SituacaoEmailComercial;
  lembrete?: SituacaoEmailComercial;
}

export interface FaixaHorario { dia: number; de: string; ate: string }

export interface DisponibilidadePessoa {
  pessoa: PessoaAgenda;
  configurada: boolean;
  versao?: number;
  faixas: FaixaHorario[];
  duracaoMinutos: number;
  intervaloMinutos: number;
  avisoDiasUteis: number;
  horizonteDias: number;
  salaUrl?: string;
  ativa: boolean;
}

export interface BloqueioAgenda { id: string; pessoa: PessoaAgenda; de: string; ate: string; motivo?: string }
export interface LinkAgenda { codigo: string; pessoaId?: string; criadoEm: string }

export interface TelaAgenda {
  proximas: Demonstracao[];
  aRegistrar: Demonstracao[];
  recentes: Demonstracao[];
  disponibilidades: DisponibilidadePessoa[];
  bloqueios: BloqueioAgenda[];
  links: LinkAgenda[];
  equipe: PessoaAgenda[];
  eu: string;
  podeEditar: boolean;
}

/** A página pública (quadro 340): só dias e horas; nada de quem está do outro lado. */
export interface AgendaPublica {
  duracaoMinutos: number;
  fuso: string;
  dias: { data: string; horarios: { inicio: string; hora: string; livre: boolean }[] }[];
  faixas: { codigo: string; nome: string }[];
}

export const ROTAS_AGENDA = {
  agenda: "/v1/comercial/agenda",
  disponibilidade: (pessoaId: string) => `/v1/comercial/agenda/disponibilidade/${pessoaId}`,
  bloqueios: "/v1/comercial/agenda/bloqueios",
  cancelarBloqueio: (id: string) => `/v1/comercial/agenda/bloqueios/${id}/cancelar`,
  links: "/v1/comercial/agenda/links",
  marcar: (interessadoId: string) => `/v1/comercial/interessados/${interessadoId}/demonstracoes`,
  remarcar: (id: string) => `/v1/comercial/demonstracoes/${id}/remarcar`,
  feita: (id: string) => `/v1/comercial/demonstracoes/${id}/feita`,
  encerrar: (id: string) => `/v1/comercial/demonstracoes/${id}/encerrar`,
  publico: (codigo: string) => `/v1/publico/agenda/${encodeURIComponent(codigo)}`,
};

export const TELA_AGENDA = "/comercial/agenda";

/** O endereço que vai no site, na mensagem pronta e na assinatura do e-mail. */
export const urlAgenda = (origem: string, codigo: string) => `${origem.replace(/\/$/, "")}/a/${codigo}`;

/** Os horários de um dia em texto: "10:00 a 12:00 · 14:00 a 17:00" ou "sem demonstração". */
export function textoDoDia(faixas: FaixaHorario[], dia: number): string {
  const doDia = faixas.filter((f) => f.dia === dia).sort((a, b) => a.de.localeCompare(b.de));
  return doDia.length ? doDia.map((f) => `${f.de} a ${f.ate}`).join(" · ") : "sem demonstração";
}

/** As linhas do cartão "Horários livres": segunda a sexta sempre; sábado e domingo só se houver. */
export function linhasHorarios(faixas: FaixaHorario[]): { dia: number; nome: string; texto: string }[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const)
    .filter((d) => d <= 5 || faixas.some((f) => f.dia === d))
    .map((d) => ({ dia: d, nome: DIAS_SEMANA_AGENDA[d], texto: textoDoDia(faixas, d) }));
}

/** "Duração de 30 minutos, intervalo de 15. Aviso mínimo de 1 dia útil." (quadro 341). */
export function apoioDisponibilidade(d: Pick<DisponibilidadePessoa, "duracaoMinutos" | "intervaloMinutos" | "avisoDiasUteis" | "horizonteDias">): string {
  const aviso = d.avisoDiasUteis === 0 ? "Sem aviso mínimo" : `Aviso mínimo de ${d.avisoDiasUteis} ${d.avisoDiasUteis === 1 ? "dia útil" : "dias úteis"}`;
  return `Duração de ${d.duracaoMinutos} minutos, intervalo de ${d.intervaloMinutos}. ${aviso}, até ${d.horizonteDias} dias à frente.`;
}

/** Os horários de um dia como se digita: "10:00-12:00, 14:00-17:00". */
export function faixasParaCampo(faixas: FaixaHorario[], dia: number): string {
  return faixas.filter((f) => f.dia === dia).sort((a, b) => a.de.localeCompare(b.de)).map((f) => `${f.de}-${f.ate}`).join(", ");
}

const HORA = /^([01]?\d|2[0-3])[:h]?([0-5]\d)?$/;
const normalHora = (t: string): string | null => {
  const m = HORA.exec(t.trim());
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2] ?? "00"}`;
};

/** "10-12, 14:00-17:00" → as faixas do dia; vazio, nenhuma. Faixas que se cruzam não passam. */
export function lerFaixasDoDia(dia: number, texto: string): { faixas: FaixaHorario[] } | { erro: string } {
  const partes = texto.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const faixas: FaixaHorario[] = [];
  for (const p of partes) {
    const [a, b, ...resto] = p.split(/\s*(?:-|–|a|até)\s*/).filter(Boolean);
    const de = a ? normalHora(a) : null;
    const ate = b ? normalHora(b) : null;
    if (!de || !ate || resto.length) return { erro: `Escreva como 10:00-12:00, 14:00-17:00` };
    if (de >= ate) return { erro: `Em ${p}, o fim vem depois do começo` };
    faixas.push({ dia, de, ate });
  }
  faixas.sort((x, y) => x.de.localeCompare(y.de));
  for (let i = 1; i < faixas.length; i++) {
    if (faixas[i]!.de < faixas[i - 1]!.ate) return { erro: "Os horários do dia se cruzam" };
  }
  return { faixas };
}

/** O selo de cada demonstração na lista (quadro 341). */
export function seloDemonstracao(d: Demonstracao): { texto: string; tom: Tom } {
  if (d.situacao !== "MARCADA") {
    return { texto: SITUACOES_DEMONSTRACAO[d.situacao], tom: d.situacao === "FEITA" ? "ok" : "neutro" };
  }
  if (d.confirmacao === "FALHOU" || d.lembrete === "FALHOU") return { texto: "E-mail não saiu", tom: "atencao" };
  if (d.remarcacoes > 0) return { texto: `Remarcou ${d.remarcacoes} ${d.remarcacoes === 1 ? "vez" : "vezes"}`, tom: "atencao" };
  if (d.lembrete === "ENVIADO") return { texto: "Lembrete enviado", tom: "ok" };
  if (d.origem === "LINK") return { texto: "Agendou pelo link", tom: "info" };
  return { texto: "Marcada pela equipe", tom: "neutro" };
}

/** O que aconteceu com a confirmação e o lembrete, por extenso (sem e-mail, diz). */
export function textoEmails(d: Demonstracao): string {
  if (!d.interessado.temEmail && !d.confirmacao) return "Sem e-mail: combine pelo WhatsApp.";
  const c = d.confirmacao ? `Confirmação: ${SITUACOES_EMAIL_COMERCIAL[d.confirmacao].toLowerCase()}` : "Sem confirmação por e-mail";
  const l = d.lembrete ? `lembrete: ${SITUACOES_EMAIL_COMERCIAL[d.lembrete].toLowerCase()}` : "sem lembrete";
  return `${c}; ${l}.`;
}

/** "ter 28/10 · 14:00", a coluna Quando do quadro 341. */
export function quandoCurtoDemo(iso: string): string {
  const [dia = "", data = "", hora = ""] = quandoDemonstracao(iso).split(", ");
  return `${dia.slice(0, 3)} ${data} · ${hora}`;
}

/** Os dias da página pública: "ter" e "28", no fuso de Brasília. */
export function chipDia(data: string): { semana: string; numero: string; mes: string } {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a!, m! - 1, d!, 12));
  const semana = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" }).format(dt).replace(".", "");
  const mes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" }).format(dt).replace(".", "");
  return { semana, numero: String(d), mes };
}

/** O botão do quadro 340: "Confirmar terça, 28/10, 14:00". */
export const textoConfirmar = (inicio: string) => `Confirmar ${quandoDemonstracao(inicio)}`;

/** O primeiro dia com horário livre (a página abre nele). */
export function primeiroDiaLivre(dias: AgendaPublica["dias"]): string | null {
  return dias.find((d) => d.horarios.some((h) => h.livre))?.data ?? null;
}

/**
 * Data e hora digitadas no Console (horário de Brasília, sem horário de verão desde 2019) → o
 * instante ISO que a API pede.
 */
export function instanteBrasilia(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  return `${data}T${hora}:00-03:00`;
}

/** O instante → a data e a hora de Brasília, para os campos. */
export function campoBrasilia(iso: string): { data: string; hora: string } {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString();
  return { data: d.slice(0, 10), hora: d.slice(11, 16) };
}

/** As mensagens das recusas do agendamento, para a página pública e para a equipe. */
export const MOTIVOS_AGENDA: Record<string, string> = {
  HORARIO_OCUPADO: "Este horário acabou de ser ocupado. Escolha outro.",
  DEMONSTRACAO_MARCADA: "Já existe uma demonstração marcada. Para mudar o horário, remarque a que existe.",
  NAO_CONTATAR: "Não conseguimos agendar com este contato.",
  INTERESSADO_FECHADO: "Este interessado está fechado (ganho ou perdido) e não marca demonstração.",
  DEMONSTRACAO_FUTURA: "A demonstração ainda não começou.",
  DEMONSTRACAO_ENCERRADA: "Esta demonstração já foi encerrada.",
  REMARCACOES: "Esta demonstração já foi remarcada muitas vezes.",
};

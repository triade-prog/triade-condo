// O que a API devolve nas Configurações do condomínio (plataforma_configuracoes e as partes que
// carregam à parte), no app e no Console.

import type { AssuntoComunicado, AvisoNovoSindico, ConfirmacaoArea, Intervalo, ModoArea, PeriodoLimite } from "@triade/domain";

export interface Configuracoes {
  fuso: string;
  versao: number;
  horarios: Record<"FUNCIONAMENTO" | "ATENDIMENTO", { intervalos: Intervalo[]; versao: number }>;
  feriados: { id: string; data: string; descricao: string }[];
  categorias: { id: string; nome: string; ativa: boolean; versao: number }[];
  prioridades: { id: string; nome: string; significado: string; nivel: number; ativa: boolean; versao: number }[];
  etapas: { id: string; nome: string; situacao: string; categoriaId: string | null; pausaPrazo: boolean; ordem: number; ativa: boolean; versao: number }[];
  modelos: { id: string; titulo: string; texto: string; categoriaId: string | null; ativo: boolean; versao: number }[];
  prazos: { id: string; categoriaId: string | null; prioridadeId: string | null; horas: number; versao: number }[];
  /** Revisão da conclusão e reabertura dos pedidos (AT-14, AT-15). */
  regrasPedidos: { revisao: boolean; reabertura: boolean };
  /** Quando o aviso sobe e os outros avisos (passo 6; F6.2, AT-09). */
  avisos: RegrasAviso;
  /** Quem fica sabendo de pedido novo (F6.4, AT-26). Só o síndico muda. */
  avisoNovo: { sindico: AvisoNovoSindico; protocolo: boolean; podeMudar: boolean };
  /** Janela dos pedidos parecidos, em dias (F7.4, AT-18). */
  parecidosDias?: number;
  pendencias: string[];
  podeEditar: boolean;
  /** Ajustes que são só da TRÍADE (PI-04, CF-09): quem pode e se pede motivo (cliente ativo). */
  tecnica?: { pode: boolean; motivo: boolean };
  /** Minutos em que o que chega pelo WhatsApp entra no mesmo pedido (W-11). */
  anexarMinutos?: number;
}

export interface RegrasAviso {
  sindicoHoras: number;
  substitutoHoras: number;
  substitutoId: string | null;
  semResponsavelHoras: number;
  pendenciaDias: number;
  substitutosPossiveis: { vinculoId: string; nome: string; cargo: string | null }[];
}

export interface PlanoComunicacao {
  assuntos: AssuntoComunicado[];
  plano?: string;
  assinatura?: string;
  silencioInicio: string;
  silencioFim: string;
  versao: number;
  podeEditar: boolean;
  mural: { ligado: boolean; codigo?: string; assuntos: AssuntoComunicado[]; aberturas: number };
  email: { ligado: boolean; responderPara?: string; comEmail: number; contatos: number };
  documentos: { noMural: boolean; automatico: boolean };
}

export interface Etiqueta {
  id: string;
  numero: number;
  rotulo: string;
  local: string;
  onde?: string;
  codigo: string;
  recado?: string;
  recadoAte?: string;
  ativa: boolean;
  motivoDesativacao?: string;
  desativadaEm?: string;
  aberturas7: number;
  aberturasHoje: number;
  semUso?: boolean;
  criadoEm: string;
  versao: number;
}

export interface LinksQr {
  numeroWhatsapp?: string;
  mural: { ligado: boolean; aberturas: number };
  etiquetas: Etiqueta[];
  prestador: { validos: number; venceEm?: string; links?: { id: string; manutencaoId: string; titulo: string; para: string; expiraEm: string }[] };
  documentos: { validos: number; venceEm?: string };
  podeEditar: boolean;
}

export interface EtiquetaDetalhe {
  etiqueta: Etiqueta;
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  podeEditar: boolean;
}

export interface AreaComumTela {
  id: string;
  modelo?: string;
  criadaPeloSindico: boolean;
  nome: string;
  ativa: boolean;
  reserva: ConfirmacaoArea;
  antecedenciaMin: number;
  antecedenciaMax: number;
  horaInicio: string;
  horaFim: string;
  modo: ModoArea;
  blocoMinutos?: number;
  capacidade?: number;
  limiteQuantidade?: number;
  limitePeriodo?: PeriodoLimite;
  toleranciaDias?: number;
  cancelarSemAvisoDias: number;
  valorCentavos?: number;
  regras?: { id: string; titulo: string };
  podeProprietarioMorador: boolean;
  podeInquilino: boolean;
  podeProprietarioAusente: boolean;
  versao: number;
}

export interface AreasComuns {
  areas: AreaComumTela[];
  documentos: { id: string; titulo: string }[];
  pode: { editar: boolean };
}

/** Configurações › WhatsApp › Comunicados pelo WhatsApp (F6.6; contagens por telefone). */
export interface ComunicadosWhatsapp {
  ligado: boolean;
  mudadoEm?: string;
  mudadoPor?: string;
  versao: number;
  conectado: boolean;
  numero?: string;
  contagens: { aceitaram: number; recusaram: number; pararam: number; semResposta: number };
  convite?: string;
  porMinuto: number;
  silencio: { inicio: string; fim: string };
  pode: { editar: boolean };
}

/** Recado no topo depois de uma ação (salvo, convite enviado...). */
export type Recado = { tom: "ok" | "info" | "atencao"; texto: string } | null;

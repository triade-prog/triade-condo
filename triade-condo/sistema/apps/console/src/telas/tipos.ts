// O que a API do Console devolve nas listas que mais de uma tela usa: a carteira, as implantações
// em andamento e os números de WhatsApp.

import type { SITUACOES_ETAPA_IMPLANTACAO, SituacaoConexao } from "@triade/domain";

export interface ClienteCarteira {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  estagio: string;
  cenario: string | null;
  funcoes: string[];
  situacoes: string[];
}

export interface ItemImplantacao {
  condominioId: string;
  nome: string;
  iniciada: boolean;
  etapas: number;
  feitas: number;
  proxima?: { numero: number; titulo: string; situacao: keyof typeof SITUACOES_ETAPA_IMPLANTACAO; responsavel?: string };
  pendencias: number;
  vencidas: number;
  proximoRetorno?: string;
  /** A pendência vencida mais antiga (D4.28); nula sem vencida. Ausente na API antiga. */
  vencida?: PendenciaVencida | null;
  /** Quantas partes da configuração já foram conferidas; nula quando a próxima etapa não é a configuração. */
  configuracao?: { conferidas: number; total: number } | null;
}

export interface PendenciaVencida {
  id: string;
  texto: string;
  comQuem: "EQUIPE" | "CLIENTE";
  responsavel: string | null;
  etapa: number | null;
  proximoRetorno: string;
}

/** " · N de T partes conferidas" quando a próxima etapa é a configuração (o servidor só manda nesse caso). */
export function partesConferidas(i: ItemImplantacao): string {
  if (!i.configuracao) return "";
  return ` · ${i.configuracao.conferidas} de ${i.configuracao.total} partes conferidas`;
}

export interface NumeroWhatsapp {
  condominioId: string;
  nome: string;
  numero?: string;
  situacao: SituacaoConexao;
  oficial?: boolean;
  desde?: string;
  termo?: boolean;
}

/** Quem atende chamados, implantações e WhatsApp: administração, implantação e suporte. */
export function atendeClientes(funcoes: string[]): boolean {
  return funcoes.some((f) => f === "ADMINISTRACAO" || f === "IMPLANTACAO" || f === "SUPORTE");
}

export function cuidaDoAcesso(funcoes: string[]): boolean {
  return funcoes.some((f) => f === "ADMINISTRACAO" || f === "SUPORTE");
}

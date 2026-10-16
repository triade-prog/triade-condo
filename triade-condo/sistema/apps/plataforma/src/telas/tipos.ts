// O que a API da Plataforma devolve nas configurações (plataforma_configuracoes) e nas
// pessoas (plataforma_pessoas).

import type { Intervalo } from "@triade/domain";

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
  pendencias: string[];
  podeEditar: boolean;
}

export interface PessoaDoCondominio {
  vinculoId: string;
  pessoaId: string;
  nome: string;
  funcao: "SINDICO" | "AUTORIZADO";
  cargo: string | null;
  permissoes: string[];
  desde: string;
  versao: number;
  responsavel: boolean;
  disponivel: boolean;
}

export interface Pessoas {
  pessoas: PessoaDoCondominio[];
  responsavelPadrao: string | null;
  versao: number;
  permissoesDisponiveis: { codigo: string; nome: string; descricao: string }[];
  pendencias: string[];
}

/** Recado no topo depois de uma ação (salvo, convite enviado...). */
export type Recado = { tom: "ok" | "info"; texto: string } | null;

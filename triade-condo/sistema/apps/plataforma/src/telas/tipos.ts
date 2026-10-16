// O que a API da Plataforma devolve nas configurações (plataforma_configuracoes), nas
// pessoas (plataforma_pessoas) e nos moradores e unidades (passo 3).

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

export interface Bloco {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  versao: number;
}

export interface Estrutura {
  agrupamento: "NENHUM" | "TORRE" | "BLOCO" | "QUADRA" | "PREDIO";
  usaAndar: boolean;
  versao: number;
}

export interface UnidadeResumo {
  id: string;
  blocoId: string | null;
  andar: string | null;
  identificacao: string;
  ativa: boolean;
  versao: number;
  confirmados: number;
  pendentes: number;
  /** Tem proprietário no cadastro; semProprietario: tem inquilino e falta o proprietário (MU-01). */
  temProprietario: boolean;
  semProprietario: boolean;
  principal: string | null;
}

export interface Unidades {
  estrutura: Estrutura;
  blocos: Bloco[];
  unidades: UnidadeResumo[];
  resumo: { unidades: number; semContato: number; aConfirmar: number; semProprietario: number };
  podeEditar: boolean;
  podeConfirmar: boolean;
}

export interface ContatoDaUnidade {
  vinculoId: string;
  contatoId: string;
  nome: string;
  telefone: string;
  contatoVersao: number;
  relacao: string;
  principal: boolean;
  recebeComunicados: boolean;
  estado: "PENDENTE" | "CONFIRMADO";
  origem: "PAINEL" | "PLANILHA";
  desde: string;
  versao: number;
  telefoneCompartilhado: boolean;
  outrasUnidades: string[];
}

export interface ContatoAnterior {
  vinculoId: string;
  contatoId: string;
  nome: string | null;
  relacao: string;
  motivo: string;
  dataSaida: string | null;
  encerradoEm: string;
  dadosRemovidos: boolean;
  contatoVersao: number;
  semVinculoAtivo: boolean;
}

export interface UnidadeDetalhe {
  unidade: { id: string; identificacao: string; blocoId: string | null; andar: string | null; bloco: string | null; ativa: boolean; versao: number };
  contatos: ContatoDaUnidade[];
  anteriores: ContatoAnterior[];
  faltaProprietario: boolean;
  podeEditar: boolean;
  podeConfirmar: boolean;
}

export interface MoradorDaLista {
  vinculoId: string;
  contatoId: string;
  nome: string;
  telefone: string;
  unidadeId: string;
  unidade: string;
  andar: string | null;
  bloco: string | null;
  relacao: string;
  principal: boolean;
  estado: "PENDENTE" | "CONFIRMADO";
  origem: "PAINEL" | "PLANILHA";
  versao: number;
}

export interface ListaMoradores {
  itens: MoradorDaLista[];
  total: number;
  pagina: number;
  porPagina: number;
  aConfirmar: number;
  podeEditar: boolean;
  podeConfirmar: boolean;
}

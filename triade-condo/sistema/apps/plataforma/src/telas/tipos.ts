// O que a API da Plataforma devolve nas configurações (plataforma_configuracoes), nas
// pessoas (plataforma_pessoas), nos moradores e unidades (passo 3) e nos pedidos (passo 4).

import type { Intervalo, Ligacao, Ocupacao, Parentesco } from "@triade/domain";

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
export type Recado = { tom: "ok" | "info" | "atencao"; texto: string } | null;

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
  /** Passo 3b (MU-10, MU-11): ocupação, o proprietário e quem é o responsável. */
  principalRelacao: string | null;
  ocupacao: Ocupacao;
  proprietario: string | null;
  proprietarioNaoMora: boolean;
  semResponsavel: boolean;
}

export interface Unidades {
  estrutura: Estrutura;
  blocos: Bloco[];
  unidades: UnidadeResumo[];
  resumo: { unidades: number; semContato: number; aConfirmar: number; semProprietario: number };
  /** Contadores do topo da lista (passo 3b, MU-11). */
  ocupacao: { comMorador: number; alugadas: number; proprietarioNaoMora: number; semResponsavel: number };
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
  proprietario: boolean;
  mora: boolean;
  ligacao: Ligacao | null;
  parentesco: Parentesco | null;
  ocupaDesde: string | null;
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
  proprietario: boolean;
  mora: boolean;
  ligacao: Ligacao | null;
  parentesco: Parentesco | null;
  ocupaDesde: string | null;
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
  ocupacao: { situacao: Ocupacao; moram: number; proprietarioNaoMora: boolean };
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

// Pedidos no painel (passo 4).

export interface OpcoesPedidos {
  categorias: { id: string; nome: string; ativa: boolean }[];
  prioridades: { id: string; nome: string; significado: string; nivel: number; ativa: boolean }[];
  etapas: { id: string; nome: string; situacao: "ABERTO" | "EM_ANDAMENTO" | "ENCERRADO"; categoriaId: string | null; pausaPrazo: boolean; ativa: boolean }[];
  responsaveis: { vinculoId: string; nome: string; disponivel: boolean; eu: boolean }[];
  pessoas: { vinculoId: string; nome: string; eu: boolean }[];
  responsavelPadrao: string | null;
  unidades: { id: string; nome: string }[];
  modelos: { id: string; titulo: string; texto: string; categoriaId: string | null }[];
  regras: { revisao: boolean; reabertura: boolean };
  pode: { registrar: boolean; responder: boolean; atualizar: boolean; concluir: boolean; revisar: boolean };
  meuVinculo: string | null;
}

export interface ResumoPedidos {
  ativos: number;
  semResponsavel: number;
  aguardandoAceite: number;
  meusParaAceitar: number;
  retornoVencido: number;
  emRevisao: number;
  comPendencia: number;
  meus: number;
  /** O início do dia (passo 7, F7.1). */
  vencemHoje: number;
  proximoHoje?: string;
  vencidoMaisAntigo?: string;
  vencidoMaisAntigoEscalado: boolean;
  pendenciasParadas: number;
}

export interface RegrasAviso {
  sindicoHoras: number;
  substitutoHoras: number;
  substitutoId: string | null;
  semResponsavelHoras: number;
  pendenciaDias: number;
  substitutosPossiveis: { vinculoId: string; nome: string; cargo: string | null }[];
}

/** Um aviso dentro do painel (passo 6, F6.1). Assunto vazio: pedido privado que a pessoa não vê. */
export interface AvisoDoPainel {
  id: string;
  tipo: "RETORNO_VENCIDO" | "ESCALADO_SINDICO" | "ESCALADO_SUBSTITUTO" | "SEM_RESPONSAVEL" | "PENDENCIA_PARADA";
  pedidoId: string;
  protocolo: string;
  assunto: string | null;
  responsavel: string | null;
  referencia: string;
  criadoEm: string;
  vistoEm: string | null;
}

export interface Avisos {
  itens: AvisoDoPainel[];
  naoVistos: number;
}

/** O aviso no pedido (AT-08, AT-09). */
export type PrazoDoPedido =
  | { vencido: false }
  | {
      vencido: true;
      desde: string;
      horas: number;
      avisos: { tipo: AvisoDoPainel["tipo"]; em: string; nomes: string[] }[];
      proximo: { tipo: "ESCALADO_SINDICO" | "ESCALADO_SUBSTITUTO"; em: string } | null;
    };

/** Números de um período (passo 7; F7.2, TR-01, TR-03, TR-07). Null é "sem dados". */
export interface NumerosAtendimento {
  de: string;
  ate: string;
  retornos: { total: number; noPrazo: number; porcentagem: number | null };
  primeiroRetornoHoras: number | null;
  registrados: number;
  concluidos: number;
  reabertos: number;
}

export interface Indicadores {
  periodo: "ESTE_MES" | "MES_PASSADO" | "TRES_MESES";
  atual: NumerosAtendimento & {
    porCategoria: { categoriaId: string; nome: string; retornos: number | null; noPrazo: number | null; porcentagem: number | null; concluidos: number }[];
  };
  porcentagemAnterior: number | null;
}

export type MesFechado = NumerosAtendimento & { mes: string; porcentagemAnterior?: number | null };

export type EstadoPedido = "ABERTO" | "EM_ANDAMENTO" | "EM_REVISAO" | "ENCERRADO" | "CANCELADO";

export interface PedidoDaFila {
  id: string;
  protocolo: string;
  assunto: string;
  estado: EstadoPedido;
  privado: boolean;
  unidade: string | null;
  local: string | null;
  categoria: string;
  prioridade: { nome: string; nivel: number };
  etapa: { nome: string; pausaPrazo: boolean };
  responsavel: { vinculoId: string; nome: string; eu: boolean } | null;
  aceito: boolean;
  abertoEm: string;
  encerradoEm: string | null;
  proximoRetorno: string | null;
  retornoVencido: boolean;
  previsao: string | null;
  pendencias: number;
}

export interface FilaPedidos {
  itens: PedidoDaFila[];
  total: number;
  pagina: number;
  porPagina: number;
  resumo: ResumoPedidos;
  agora: string;
}

export interface PendenciaPedido {
  id: string;
  tipo: string;
  motivo: string;
  responsavel: { vinculoId: string; nome: string; ativo: boolean };
  abertaEm: string;
  abertaPor: string;
  resolvidaEm: string | null;
  resolvidaPor: string | null;
  resolucao: string | null;
}

export interface ConclusaoPedido {
  id: string;
  etapa: string;
  explicacao: string;
  evidencia: string | null;
  concluidaEm: string;
  concluidaPor: string;
  revisao: "SEM_REVISAO" | "AGUARDANDO" | "APROVADA" | "DEVOLVIDA";
  revisadaEm: string | null;
  revisadaPor: string | null;
  motivoDevolucao: string | null;
  reabertaEm: string | null;
  reabertaPor: string | null;
  motivoReabertura: string | null;
}

export interface PedidoDetalhe {
  pedido: {
    id: string;
    protocolo: string;
    assunto: string;
    descricao: string;
    canal: string;
    privado: boolean;
    estado: EstadoPedido;
    local: string | null;
    versao: number;
    unidade: { id: string; nome: string } | null;
    contato: { id: string; nome?: string; telefone?: string; relacao?: string; dadosRemovidos: boolean } | null;
    categoria: { id: string; nome: string };
    prioridade: { id: string; nome: string; nivel: number; significado: string };
    etapa: { id: string; nome: string; situacao: string; pausaPrazo: boolean };
    responsavel: { vinculoId: string; nome: string; eu: boolean; desde: string; aceitoEm: string | null } | null;
    proximoRetorno: string | null;
    retornoVencido: boolean;
    previsao: string | null;
    abertoEm: string;
    registradoPor: string;
    encerradoEm: string | null;
    cancelamento: { em: string; motivo: string; por: string } | null;
  };
  pendencias: PendenciaPedido[];
  andamentos: { id: string; tipo: "RETORNO" | "NOTA"; meio: string | null; texto: string; em: string; autor: string }[];
  conclusoes: ConclusaoPedido[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  pode: { responder: boolean; atualizar: boolean; concluir: boolean; revisar: boolean; aceitar: boolean; repassar: boolean };
  regras: { revisao: boolean; reabertura: boolean };
  agora: string;
}

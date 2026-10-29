// O que a API devolve para Orçamentos e compras (R8; contrato em docs/orcamentos-r8/plano-0317,
// seção API). A API falsa dos testes (tests/e2e/api-falsa-orcamentos.ts) segue o mesmo contrato.

import type { AbaixoMinimo, CanalConvite, EstadoConvite, EstadoLinkOrcamento, EstadoOrcamento, QuemAprovaFaixa, QuemAprovaOrcamento, TipoOrcamento } from "@triade/domain";

export interface OrigemOrcamento { tipo: "MANUTENCAO" | "PEDIDO" | "PREVENTIVA" | "MAO"; id: string | null; texto: string }

export interface OrcamentoDaLista {
  id: string;
  titulo: string;
  tipo: TipoOrcamento;
  local: string | null;
  estado: EstadoOrcamento;
  situacao: string;
  origem: OrigemOrcamento | null;
  convidados: number;
  recebidas: number;
  recusas: number;
  prazoPropostas: string;
  prazoFechou: boolean;
  vencidas: number;
  escolhida: { nome: string; total: number } | null;
  decididoEm: string | null;
  concluidoEm: string | null;
  pedeAtencao: string[];
  versao: number;
}

export interface ListaOrcamentos {
  hoje: string;
  pode: { criar: boolean };
  contagens: { pedindo: number; comparar: number; decidir: number; comprando: number };
  orcamentos: OrcamentoDaLista[];
}

export interface FaixaOrcamento { ate: number | null; minimo: number; quemAprova: QuemAprovaFaixa }

export interface RegrasDoOrcamento {
  ligada: boolean;
  faixas: FaixaOrcamento[];
  abaixoMinimo: AbaixoMinimo;
  prazoDias: number;
  validadeDias: number;
  linkDias: number;
  alcadaConselho: number | null;
}

export interface OpcoesOrcamento {
  prestadores: { id: string; nome: string; servico: string | null; canal: CanalConvite; servicosFeitos: number; celular?: string | null; email?: string | null }[];
  manutencoes: { id: string; titulo: string; local: string | null }[];
  pedidos: { id: string; numero: string; titulo: string }[];
  locais: string[];
  regras: RegrasDoOrcamento;
  conselho: { podePedir: boolean; titulares: number };
}

/** O link de cada convidado, logo depois de criar, convidar ou reenviar (quadro 475). */
export interface LinkConvite {
  conviteId: string;
  nome: string;
  canal: CanalConvite;
  envio: "EMAIL" | "COPIAR";
  codigo?: string;
  mensagem: string;
  /** Só dígitos, para abrir o WhatsApp já na conversa; sem ele, o WhatsApp pede o contato. */
  celular?: string | null;
}

export interface PropostaEmUso {
  id: string;
  numero: number;
  total: number;
  valor: number;
  frete: number;
  freteIncluso: boolean;
  garantia: string | null;
  prazoExecucao: string;
  validaAte: string;
  vencida: boolean;
  confirmacaoPedidaEm: string | null;
  confirmadaEm?: string | null;
  marcaModelo?: string | null;
  pagamento?: string | null;
  inclui?: string;
  naoInclui?: string | null;
  pdf?: { id: string; nome: string } | null;
  enviadaEm?: string;
}

export interface ConviteDoOrcamento {
  id: string;
  letra: string;
  nome: string;
  origem: "PRESTADOR" | "LINK";
  prestadorId: string | null;
  canal: CanalConvite;
  contatoMascarado: string | null;
  estado: EstadoConvite;
  aberturas: number;
  recusaMotivo: string | null;
  recusouEm?: string | null;
  propostaEmUso: PropostaEmUso | null;
  versoes: number;
  revogado: { em: string; motivo: string } | null;
  escolhido: boolean;
  versao: number;
}

export interface ArquivoOrcamento { id: string; nome: string; tipo: string; tamanho: number; situacao?: "ENVIANDO" | "LIBERADO" | "NAO_LIBERADO" }

export interface EscolhaDoOrcamento {
  propostaId: string;
  convite: { id: string; letra: string; nome: string; prestadorId: string | null };
  total: number;
  motivo: string | null;
  quemAprova: QuemAprovaOrcamento;
  escolhidaEm: string;
  escolhidaPor: string;
  despesaId: string | null;
  despesaEstado: string | null;
  aprovadaEm: string | null;
  aprovadaTexto?: string | null;
  aceiteEm: string | null;
  aceiteNome: string | null;
  aceiteForaDoLink: boolean;
  semAceiteHaDias: number | null;
  avisadas: number;
}

export interface Orcamento {
  id: string;
  titulo: string;
  descricao: string;
  local: string | null;
  tipo: TipoOrcamento;
  estado: EstadoOrcamento;
  situacao: string;
  origem: OrigemOrcamento | null;
  valorEstimado: number | null;
  prazoPropostas: string;
  prazoFechou: boolean;
  validadeMinimaDias: number;
  cuidador: { nome: string; cargo: string };
  criadoEm: string;
  criadoPor: string;
  editadoEm: string | null;
  convidados: number;
  recebidas: number;
  recusas: number;
  regra: { ligada: boolean; faixa: FaixaOrcamento | null; anterior: number | null; minimoAtendido: boolean; alcadaConselho: number | null; passaAlcada: boolean };
  escolha: EscolhaDoOrcamento | null;
  compra: { compradaEm: string; valorFechado: number; notaFiscal: { id: string; nome: string } | null } | null;
  entrega: { entregueEm: string; parcial: boolean; observacao: string | null } | null;
  cancelado: { em: string; motivo: string } | null;
  versao: number;
}

export interface EventoOrcamento { em: string; texto: string; tom: "violeta" | "ok" | "atencao" | "neutro" | "erro" }

export interface PodeNoOrcamento {
  editar: boolean; convidar: boolean; estender: boolean; fechar: boolean; comparar: boolean; decidir: boolean; desfazerEscolha: boolean;
  registrarCompra: boolean; registrarEntrega: boolean; cancelar: boolean; aceiteFora: boolean;
}

export interface OrcamentoDetalhe {
  orcamento: Orcamento;
  convites: ConviteDoOrcamento[];
  arquivos: ArquivoOrcamento[];
  historico: EventoOrcamento[];
  pode: PodeNoOrcamento;
}

export interface PropostaComparada {
  conviteId: string;
  propostaId: string;
  letra: string;
  nome: string;
  origem: "PRESTADOR" | "LINK";
  numero: number;
  versoes: number;
  total: number;
  valor: number;
  frete: number;
  freteIncluso: boolean;
  marcaModelo: string | null;
  prazoExecucao: string;
  garantia: string | null;
  inclui: string;
  naoInclui: string | null;
  faltaAlgo: boolean;
  validaAte: string;
  vencida: boolean;
  confirmada: boolean;
  confirmacaoPedidaEm: string | null;
  pagamento: string | null;
  pdf: { id: string; nome: string } | null;
  anteriores: { numero: number; total: number; validaAte: string; enviadaEm: string }[];
}

export interface Comparacao {
  propostas: PropostaComparada[];
  menorTotal: string | null;
  minimo: { pedido: number; recebidas: number; atendido: boolean };
  alcadaConselho: number | null;
  faixa: FaixaOrcamento | null;
  pode: { decidir: boolean };
}

export interface RegrasOrcamentoApi extends RegrasDoOrcamento {
  versao: number;
  pode: { editar: boolean };
}

/** O que o fornecedor vê pelo link /o/<código> (quadros 476 a 478). */
export interface OrcamentoPublico {
  estado: EstadoLinkOrcamento;
  motivo?: "LINK_TROCADO" | "REVOGADO" | "VENCIDO";
  condominio: string;
  fornecedor: { nome: string };
  pedido?: {
    titulo: string;
    descricao: string;
    local: string | null;
    prazoPropostas: string;
    validadeMinimaDias: number;
    arquivos: { id: string; nome: string; tipo: string }[];
    editadoEm?: string | null;
  };
  proposta: (PropostaEmUso & { pdf?: { id: string; nome: string } | null }) | null;
  aceite: { em: string; nome: string } | null;
  /** O que mais o fornecedor precisa saber (prazo fechou, pedido alterado…). */
  mensagens: string[];
  hoje: string;
}

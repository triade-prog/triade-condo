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
  escolhida?: { nome: string; total: number } | null;
  decididoEm?: string | null;
  concluidoEm?: string | null;
  canceladoEm?: string | null;
  /** PRAZO_FECHOU, PROPOSTA_VENCIDA ou SEM_ACEITE. */
  pedeAtencao: ("PRAZO_FECHOU" | "PROPOSTA_VENCIDA" | "SEM_ACEITE")[];
  versao: number;
}

export interface ListaOrcamentos {
  hoje: string;
  pode: { criar: boolean; decidir?: boolean };
  contagens: { pedindo: number; comparar: number; decidir: number; comprando: number; emAndamento?: number; decididos?: number; encerrados?: number; cancelados?: number };
  orcamentos: OrcamentoDaLista[];
}

export interface FaixaOrcamento { ate: number | null; minimo: number; quemAprova: QuemAprovaFaixa }
/** A faixa que vale para um orçamento: sem `ate` quando é a última (sem teto). */
export interface FaixaDoOrcamento { ate?: number | null; minimo: number; quemAprova: QuemAprovaFaixa }

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
  hoje?: string;
  /** Quem manda: monta a mensagem pronta e o "Quem aprova" da escolha. */
  quem: { nome: string; cargo: string; condominio: string };
  prestadores: { id: string; nome: string; servico: string | null; canal: CanalConvite; servicosFeitos: number }[];
  manutencoes: { id: string; titulo: string; local: string | null }[];
  pedidos: { id: string; numero: string; titulo: string }[];
  locais: string[];
  regras: RegrasDoOrcamento;
  conselho: { podePedir: boolean; titulares: number };
}

/** O link de cada convidado, logo depois de criar, convidar, mandar, reenviar ou pedir a confirmação (quadro 475). */
export interface LinkConvite {
  conviteId: string;
  nome: string;
  letra?: string;
  canal: CanalConvite;
  /** COPIAR: pelo WhatsApp de quem manda, com `link` e `texto` prontos; EMAIL: já saiu pela fila. */
  envio: "EMAIL" | "COPIAR";
  codigo?: string;
  mensagem: { quem: string; cargo: string; prazo: string; titulo: string; condominio: string };
  link?: string;
  texto?: string;
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
  confirmacaoPedidaEm?: string | null;
  confirmada?: boolean;
  faltaAlgo?: boolean;
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
  /** COPIAR (WhatsApp) ou o estado do último e-mail (NA_FILA, ENVIADO, CANCELADO...). */
  envio?: string;
  mandadoEm?: string | null;
  ultimaAberturaEm?: string | null;
  aceiteForaDoLink?: boolean;
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

export interface ArquivoOrcamento { id: string; parte?: "PEDIDO" | "NOTA_FISCAL"; nome: string; tipo: string; tamanho: number; situacao?: "ENVIANDO" | "LIBERADO" | "NAO_LIBERADO" }

export interface EscolhaDoOrcamento {
  propostaId: string;
  convite: { id: string; letra: string; nome: string };
  total: number;
  motivo: string | null;
  quemAprova: QuemAprovaOrcamento;
  escolhidaEm: string;
  escolhidaPor: string;
  despesaId: string | null;
  despesaEstado: string | null;
  aprovadaEm?: string | null;
  despesaJustificativa?: string | null;
  aceiteEm?: string | null;
  aceiteNome?: string | null;
  aceiteForaDoLink: boolean;
  semAceiteHaDias?: number | null;
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
  cuidador: { id: string; nome: string };
  criadoEm: string;
  criadoPor: string;
  editadoEm: string | null;
  convidados: number;
  recebidas: number;
  recusas: number;
  regra: {
    ligada: boolean; faixa?: FaixaDoOrcamento | null; minimo: number; recebidas: number; anterior?: number | null; minimoAtendido: boolean;
    abaixoMinimo: AbaixoMinimo; alcadaConselho?: number | null; passaAlcada: boolean;
  };
  /** O conselho recusou (ou a despesa foi retirada): volta a COMPARANDO com a recusa à vista. */
  recusa?: { em: string; estado: string; despesaId: string; justificativa?: string | null } | null;
  escolha: EscolhaDoOrcamento | null;
  compra: { compradaEm: string; valorFechado: number; notaFiscal: { id: string; nome: string } | null } | null;
  entrega: { entregueEm: string; parcial: boolean; observacao: string | null } | null;
  cancelado?: { em: string; motivo: string; por?: string } | null;
  versao: number;
}

export interface EventoOrcamento { em: string; acao?: string; quem?: string; dados?: Record<string, unknown>; texto: string; tom?: "violeta" | "ok" | "atencao" | "neutro" | "erro" }

export interface PodeNoOrcamento {
  editar: boolean; convidar: boolean; mandar: boolean; anexar: boolean; estender: boolean; fechar: boolean; comparar: boolean; decidir: boolean; desfazerEscolha: boolean;
  registrarCompra: boolean; registrarEntrega: boolean; cancelar: boolean; aceiteFora: boolean;
}

export interface OrcamentoDetalhe {
  hoje?: string;
  orcamento: Orcamento;
  convites: ConviteDoOrcamento[];
  arquivos: ArquivoOrcamento[];
  historico: EventoOrcamento[];
  pode: PodeNoOrcamento;
}

export interface PropostaComparada {
  conviteId: string;
  /** O id da proposta (vai em `propostaId` ao escolher). */
  id: string;
  prestadorId?: string | null;
  conviteEstado?: EstadoConvite;
  menorTotal: boolean;
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
  confirmacaoPedidaEm?: string | null;
  pagamento: string | null;
  pdf?: { id: string; nome: string } | null;
  enviadaEm?: string;
  anteriores: { id?: string; numero: number; total: number; validaAte: string; enviadaEm: string }[];
}

export interface Comparacao {
  hoje?: string;
  propostas: PropostaComparada[];
  menorTotal: string | null;
  minimo: { pedido: number; recebidas: number; atendido: boolean; abaixoMinimo: AbaixoMinimo };
  regra: Orcamento["regra"];
  conselho: { podePedir: boolean; titulares: number };
  orcamento: { id: string; titulo: string; estado: string; versao: number; local?: string | null; descricao?: string; motivoEscolha?: string | null; valorEstimado?: number | null; propostaEscolhidaId?: string | null };
  alcadaConselho: number | null;
  pode: { decidir: boolean; pedirConfirmacao?: boolean };
}

export interface RegrasOrcamentoApi extends RegrasDoOrcamento {
  versao: number;
  pode: { editar: boolean };
}

/** O que o fornecedor vê pelo link /o/<código> (quadros 476 a 478). */
export interface OrcamentoPublico {
  hoje?: string;
  estado: EstadoLinkOrcamento;
  motivo?: "LINK_TROCADO" | "REVOGADO" | "VENCIDO";
  pode?: { aceitar: boolean; recusar: boolean; confirmarPreco: boolean; mandarProposta: boolean };
  condominio: string;
  fornecedor: { nome: string; canal?: CanalConvite };
  pedido?: {
    quem?: { nome: string; cargo: string };
    tipo?: TipoOrcamento;
    titulo: string;
    descricao: string;
    local: string | null;
    prazoTexto?: string;
    prazoPropostas: string;
    validadeMinimaDias: number;
    arquivos: { id: string; nome: string; tipo: string }[];
    alteradoEm?: string | null;
  };
  versoes?: number;
  /** A versão que acabou de ir (resposta do POST /proposta). */
  numero?: number;
  avisoValidade?: string | null;
  proposta?: PropostaEmUso | null;
  escolha?: { em: string; total: number; aprovada: boolean; esperaAprovacao: boolean } | null;
  aceite?: { em: string; nome: string } | null;
  recusa?: { em: string; motivo: string | null } | null;
}

// Comercial (0296): o que a api-console devolve para a lista, o Meu dia, a ficha e os modelos.

import type { CanalConversa, SituacaoContrato, CriterioSindico, EtapaComercial, MotivoPerda, OrigemComercial, PapelContato, SituacaoTarefa } from "@triade/domain";
import type { Oportunidade, Piloto } from "./cliente.ts";

export interface Tarefa {
  situacao: SituacaoTarefa;
  tarefa?: "PRIMEIRO_RETORNO" | "PROXIMO_PASSO" | "CADENCIA";
  texto?: string;
  canal?: "WHATSAPP" | "LIGACAO" | "EMAIL";
  quando?: string;
  passo?: number;
  passos?: number;
  diasParado?: number;
}

export interface Pessoa {
  id: string;
  nome: string;
}

export interface Interessado {
  id: string;
  versao: number;
  condominio: string;
  cidade?: string;
  uf?: string;
  faixa?: string;
  unidades?: number;
  pessoa?: string;
  papel?: PapelContato;
  whatsappMascarado?: string;
  origem: OrigemComercial;
  origemDetalhe?: string;
  etapa: EtapaComercial;
  etapaDesde: string;
  probabilidade?: number;
  responsavel?: Pessoa;
  proximoPasso?: { texto: string; data: string; hora?: string };
  primeiroRetornoAte?: string;
  primeiraRespostaEm?: string;
  ultimaConversa?: { em: string; resumo: string; canal: CanalConversa };
  motivoPerda?: MotivoPerda;
  anonimizado: boolean;
  criadoEm: string;
  tarefa: Tarefa;
  atencao: boolean;
  temWhatsapp: boolean;
}

export interface EtapaParametro {
  etapa: EtapaComercial;
  ordem: number;
  aberta: boolean;
  probabilidade: number;
  limiteDias?: number;
  versao: number;
}

export interface ListaComercial {
  interessados: Interessado[];
  contagens: { atencao: number; abertos: number; porEtapa: Partial<Record<EtapaComercial, number>> };
  etapas: EtapaParametro[];
  equipe: Pessoa[];
  podeEditar: boolean;
  podeExportar: boolean;
}

export interface MeuDia {
  atrasados: Interessado[];
  hoje: Interessado[];
  semPasso: Interessado[];
  equipe: Pessoa[];
  podeEditar: boolean;
}

export interface Conversa {
  id: string;
  canal: CanalConversa;
  resumo: string;
  respondeu: boolean;
  em: string;
  passo?: number;
  autor?: Pessoa;
}

export interface Concorrente {
  nome: string;
  preco?: number;
  venceu?: boolean;
}

export interface Predio {
  administradora?: string;
  appAdministradora?: boolean;
  sistemaAtual?: string;
  fidelidadeAte?: string;
  assembleiaOrdinaria?: string;
  mandatoAte?: string;
  decisor?: string;
  decisaoEm?: string;
  visitaEm?: string;
  visitaNota?: string;
  demonstracaoEm?: string;
  /** O que o síndico marcou na visita para comparar (0307), na ordem da lista. */
  criterios?: CriterioSindico[];
  criterioOutro?: string;
  /** O problema do prédio, em texto curto: abre a apresentação do kit. */
  problema?: string;
}

export interface Objecao {
  codigo: string;
  texto: string;
  resposta: string;
}

export interface PassoCadencia {
  dia: number;
  canal: "WHATSAPP" | "LIGACAO" | "EMAIL";
  texto: string;
}

export interface FichaInteressado extends Interessado {
  whatsapp?: string;
  email?: string;
  cnpj?: string;
  endereco?: string;
  utm?: Record<string, string>;
  lote?: { id: string; arquivo: string; origem: string };
  baseLegal: { tipo: "CONSENTIMENTO" | "LEGITIMO_INTERESSE"; texto: string; em: string };
  optin?: { em: string; canal: string; texto: string };
  naoContatar: boolean;
  predio: Predio;
  objecoes: string[];
  concorrentes: Concorrente[];
  perda?: { motivo: MotivoPerda; detalhe?: string; vencedor?: string; retomarEm?: string };
  observacao?: string;
  cadencia?: { id: string; nome: string; passos: PassoCadencia[]; feitos: number; inicio: string; fimEm?: string; fimMotivo?: string };
  falta?: Partial<Record<EtapaComercial, string[]>>;
  conversas: Conversa[];
  etapas: { de?: EtapaComercial; para: EtapaComercial; motivoPerda?: MotivoPerda; em: string; autor?: Pessoa }[];
  mensagens: { id: string; titulo: string; texto: string }[];
  objecoesLista: Objecao[];
  etapasLista: EtapaParametro[];
  equipe: Pessoa[];
  podeEditar: boolean;
  podeExcluir: boolean;
  /** O primeiro interessado do contato (CM-09, 0308): o grupo das oportunidades. */
  contatoDe?: string;
  /** As outras oportunidades do mesmo contato, cada uma com a sua etapa. */
  oportunidades?: Oportunidade[];
  piloto?: Piloto;
  /** A situação do contrato vigente: Virar cliente só libera em ASSINADO. */
  contratoSituacao?: SituacaoContrato;
  virouClienteEm?: string;
}

export interface MensagemModelo {
  id: string;
  etapa: EtapaComercial;
  titulo: string;
  texto: string;
  ativa: boolean;
  versao: number;
}

export interface CadenciaModelo {
  id: string;
  nome: string;
  gatilho: EtapaComercial;
  origem?: OrigemComercial;
  passos: PassoCadencia[];
  terminaSemResposta: boolean;
  ativa: boolean;
  versao: number;
  emUso?: number;
}

export interface ModelosComercial {
  mensagens: MensagemModelo[];
  cadencias: CadenciaModelo[];
  objecoes: Objecao[];
  etapas: EtapaParametro[];
  podeEditar: boolean;
}

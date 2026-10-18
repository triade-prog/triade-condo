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
  /** E-mail do contato (CD-13): só a própria pessoa confirma. */
  email?: string;
  emailSituacao?: "PENDENTE" | "CONFIRMADO" | "DEVOLVIDO" | "PAROU";
  emailComunicados?: boolean;
  emailParouMotivo?: "PEDIDO" | "SPAM";
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
  emailLigado?: boolean;
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
  emailSituacao?: "PENDENTE" | "CONFIRMADO" | "DEVOLVIDO" | "PAROU";
}

export interface ListaMoradores {
  itens: MoradorDaLista[];
  total: number;
  pagina: number;
  porPagina: number;
  aConfirmar: number;
  /** Contatos sem e-mail confirmado (CD-13). */
  semEmail?: number;
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
  tipo: "RETORNO_VENCIDO" | "ESCALADO_SINDICO" | "ESCALADO_SUBSTITUTO" | "SEM_RESPONSAVEL" | "PENDENCIA_PARADA" | "MANUTENCAO_RETORNO_VENCIDO"
    | "DOCUMENTO_VENCENDO" | "DOCUMENTO_PEDIDO" | "EMAIL_DEVOLVIDO" | "EMAIL_SPAM" | "PRESTADOR_IMPEDIMENTO" | "PRESTADOR_TERMINOU"
    | "PRONTUARIO_VENCE" | "PRONTUARIO_VENCEU" | "EXPORTACAO_PRONTA" | "EXPORTACAO_FALHOU";
  pedidoId?: string;
  protocolo?: string;
  assunto?: string | null;
  /** No aviso da manutenção (peça R6). */
  manutencaoId?: string;
  titulo?: string;
  /** No aviso do documento perto de vencer (peça R1); a referência é a data "vale até". */
  documentoId?: string;
  /** No aviso de e-mail que voltou ou virou spam (CD-13). */
  contatoId?: string;
  nome?: string;
  unidades?: string;
  comunicadoId?: string;
  /** No aviso do prontuário e da exportação (peça R10). */
  itemId?: string;
  exportacaoId?: string;
  responsavel?: string | null;
  referencia?: string;
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

// Agenda do condomínio (peça R7).

export type TipoCompromisso = "REUNIAO" | "VISITA" | "ATIVIDADE" | "LEMBRETE";
export type SituacaoCompromisso = "PLANEJADO" | "A_CONFIRMAR" | "CONFIRMADO" | "REALIZADO" | "CANCELADO";
export type LugarCompromisso = "NENHUM" | "UNIDADE" | "AREA_COMUM" | "OUTRO";

export interface CompromissoAgenda {
  id: string;
  tipo: TipoCompromisso;
  titulo: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  diaTodo: boolean;
  onde: LugarCompromisso;
  unidadeId?: string;
  local?: string;
  lugar?: string;
  participantes: { vinculoId: string; nome: string }[];
  deFora?: string;
  observacao?: string;
  estado: SituacaoCompromisso;
  versao: number;
  pedido?: { id: string; protocolo: string; assunto: string };
  pedidoOculto?: boolean;
  /** A manutenção ligada (peça R6), para quem vê a manutenção. */
  manutencao?: { id: string; titulo: string; estado: string };
  serie?: { id: string; frequencia: string; intervalo: number; ate: string; total: number };
  cancelamento?: { em: string; motivo: string; por: string | null };
  realizadoEm?: string;
}

export interface DataDeOutraTela {
  data: string;
  titulo: string;
  fonte: "FERIADO" | "PREVENTIVA";
  /** Na preventiva, o id dela. */
  id?: string;
}

export interface Agenda {
  compromissos: CompromissoAgenda[];
  datas: DataDeOutraTela[];
  hoje: string;
  pode: { editar: boolean };
}

export interface OpcoesAgenda {
  pessoas: { vinculoId: string; nome: string; eu: boolean }[];
  unidades: { id: string; nome: string }[];
  pedidos: { id: string; protocolo: string; assunto: string; unidadeId: string | null; responsavelId: string | null }[];
  pode: { editar: boolean };
  hoje: string;
}

export interface ConflitoCompromisso {
  id: string;
  titulo: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  motivo: "LUGAR" | "PESSOA";
  pessoas?: string[];
}

export interface CompromissoDetalhe {
  compromisso: CompromissoAgenda & { registradoPor: string | null; registradoEm: string };
  conflitos: ConflitoCompromisso[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  hoje: string;
  pode: { editar: boolean };
}

export interface AgendaDoPedido {
  podeVer: boolean;
  podeMarcar: boolean;
  compromissos: CompromissoAgenda[];
  divergencia: { previsao: string; compromissoId: string; titulo: string; data: string } | null;
}

// Manutenção e prestadores (peça R6).

export type TipoManutencao = "CORRETIVA" | "PREVENTIVA" | "VISTORIA";
export type SituacaoManutencao = "PLANEJADA" | "EM_ANDAMENTO" | "PENDENTE" | "CONCLUIDA" | "CANCELADA";
export type Executor = { tipo: "PRESTADOR" | "EQUIPE" | "TEXTO"; id?: string; nome: string };

export interface ManutencaoResumo {
  id: string;
  tipo: TipoManutencao;
  titulo: string;
  local: string;
  estado: SituacaoManutencao;
  etapa?: { id: string; nome: string };
  prioridade?: { id: string; nome: string; nivel: number };
  responsavel: { vinculoId: string; nome: string | null };
  executor?: Executor;
  proximoRetorno?: string;
  retornoVencido: boolean;
  previsao?: string;
  dataPrevista?: string;
  atrasada: boolean;
  pendencia?: { tipo: string; motivo: string; desde: string };
  pedido?: { id: string; protocolo: string; assunto: string; estado: string };
  preventivaId?: string;
  visita?: { id: string; data: string; horaInicio?: string };
  realizadaEm?: string;
  concluidaEm?: string;
  criadoEm: string;
  versao: number;
}

export interface ListaManutencoes {
  itens: ManutencaoResumo[];
  total: number;
  pagina: number;
  atalhos: { retornoVencido: number; preventivasMes: number; pendentesParadas: number };
  pendenciaDias: number;
  pode: { editar: boolean };
}

export interface OpcoesManutencao {
  pessoas: { vinculoId: string; nome: string; cargo: string | null; eu: boolean; veManutencao: boolean }[];
  prestadores: { id: string; nome: string; servico: string }[];
  prioridades: { id: string; nome: string; significado: string; nivel: number }[];
  etapas: { id: string; nome: string; situacao: SituacaoManutencao }[];
  locais: string[];
  pedidos: { id: string; protocolo: string; assunto: string }[];
  pode: { editar: boolean; agenda: boolean };
  pendenciaDias: number;
  hoje: string;
}

export interface Providencia {
  id: string;
  texto: string;
  executor?: Executor;
  feitaEm?: string;
  feitaPor?: string;
  resultado?: string;
  criadoEm: string;
}

export interface ItemVistoria {
  id: string;
  texto: string;
  ordem: number;
  resultado?: "CERTO" | "PROBLEMA" | "NAO_DEU";
  observacao?: string;
  respondidoEm?: string;
  fotos: number;
  gerada?: { id: string; titulo: string; estado: SituacaoManutencao };
}

export interface ManutencaoDetalhe {
  manutencao: ManutencaoResumo & {
    detalhes?: string;
    acesso?: string;
    impedimento?: string;
    registradaPor?: string;
    conclusao?: { texto: string; realizadaEm: string; em: string; por: string | null };
    cancelamento?: { motivo: string; em: string; por: string | null };
    origem?: { id: string; titulo: string; tipo: TipoManutencao };
    preventiva?: { id: string; unidadeTempo: "SEMANA" | "MES" | "ANO"; intervalo: number; proximaData: string };
    pedidoOculto?: boolean;
  };
  prestador?: { id: string; nome: string; servico: string; acordo: string; contato?: string; telefone?: string; email?: string;
    reserva?: { id: string; nome: string } };
  providencias: Providencia[];
  itens: ItemVistoria[];
  geradas: { id: string; titulo: string; estado: SituacaoManutencao }[];
  compromissos?: CompromissoAgenda[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  pode: { editar: boolean; reabrir: boolean; enviar: boolean; marcarVisita: boolean };
  hoje: string;
}

export interface PrestadorItem {
  id: string;
  nome: string;
  servico: string;
  contato?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  acordo: "CONTRATO" | "CHAMADO";
  contratoAte?: string;
  desde?: string;
  observacao?: string;
  reserva?: { id: string; nome: string };
  arquivado: boolean;
  abertas: number;
  pendentes: number;
  contratoVence: boolean;
  contratoVencido: boolean;
  versao: number;
}

export interface ListaPrestadores {
  itens: PrestadorItem[];
  arquivados: number;
  pode: { editar: boolean };
}

export interface PrestadorDetalhe {
  prestador: PrestadorItem;
  manutencoes: ManutencaoResumo[];
  reservaDe: { id: string; nome: string }[];
  pode: { editar: boolean };
}

export interface PreventivaItem {
  id: string;
  atividade: string;
  local: string;
  unidadeTempo: "SEMANA" | "MES" | "ANO";
  intervalo: number;
  proximaData: string;
  antecedenciaDias: number;
  responsavel: { vinculoId: string; nome: string | null };
  executor?: Executor;
  observacao?: string;
  ativa: boolean;
  versao: number;
  aberta?: ManutencaoResumo;
  ultima?: { id: string; realizadaEm: string };
}

export interface ListaPreventivas {
  itens: PreventivaItem[];
  hoje: string;
  pode: { editar: boolean };
}

export interface ManutencoesDoPedido {
  podeVer: boolean;
  podeAbrir: boolean;
  manutencoes: ManutencaoResumo[];
}

export interface ResumoManutencao {
  abertas: number;
  retornoVencido: number;
  vencidaMaisAntiga?: { id: string; titulo: string; desde: string };
  preventivasAtrasadas: number;
  atrasadaMaisAntiga?: { id: string; titulo: string; data: string };
  contratosAVencer: number;
  contratoMaisProximo?: { id: string; nome: string; ate: string };
}

// ---------------------------------------------------------------------------------------
// Comunicados e documentos (peça R1).

export type AssuntoComunicado = "AVISO" | "OBRAS" | "SEGURANCA" | "ASSEMBLEIA" | "LEMBRETE";
export type SituacaoComunicado = "RASCUNHO" | "PROGRAMADO" | "PUBLICADO" | "SUBSTITUIDO" | "ARQUIVADO";
export type PublicoComunicado = "TODOS" | "BLOCOS" | "UNIDADES" | "CONTATOS";

export interface EventoHistorico {
  acao: string;
  em: string;
  autor: string | null;
  dados: Record<string, unknown>;
}

export interface ComunicadoResumo {
  id: string;
  familiaId: string;
  numero: number;
  assunto: AssuntoComunicado;
  titulo: string;
  estado: SituacaoComunicado;
  publico: PublicoComunicado;
  publicoResumo: string;
  destinatarios?: number;
  programadoPara?: string;
  publicadoEm?: string;
  publicadoPor?: string;
  autor?: string;
  pedido?: { id: string; protocolo: string; assunto: string };
  manutencao?: { id: string; titulo: string; estado: string };
  arquivadoEm?: string;
  substituidoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  versao: number;
}

export interface ListaComunicados {
  itens: ComunicadoResumo[];
  total: number;
  pagina: number;
  atalhos: { rascunhosParados: number; programadosHoje: number };
  pode: { publicar: boolean };
}

export interface PublicoCalculado {
  contatos: number;
  unidades: number;
  semNinguem: { id: string; nome: string }[];
  quem?: { contatoId: string; nome: string; unidades: string[]; email?: boolean }[];
  /** Quantos recebem por e-mail (e-mail confirmado e sem ter parado). */
  comEmail?: number;
  blocos?: { id: string; nome: string }[];
  unidadesEscolhidas?: { id: string; nome: string }[];
  contatosEscolhidos?: { id: string; nome: string }[];
}

export interface ArquivoComunicado {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  situacao: "ENVIANDO" | "LIBERADO" | "NAO_LIBERADO";
  motivoRecusa?: string;
  enviadoEm: string;
  enviadoPor?: string;
  podeTirar: boolean;
}

export interface ComunicadoDetalhe {
  comunicado: ComunicadoResumo & {
    texto: string;
    assinatura?: string;
    mudanca?: string;
    blocos: string[];
    unidades: string[];
    contatos: string[];
    pedidoId?: string;
    manutencaoId?: string;
    arquivamento?: { motivo: string; em: string; por?: string };
    pedidoOculto?: boolean;
  };
  publicoAgora: PublicoCalculado;
  versoes: { id: string; numero: number; estado: SituacaoComunicado; titulo: string; texto: string; mudanca?: string;
    publicadoEm?: string; publicadoPor?: string; substituidoEm?: string }[];
  arquivos: ArquivoComunicado[];
  historico: EventoHistorico[];
  pode: { editar: boolean; corrigir: boolean; arquivar: boolean; enviar: boolean; copiar: boolean; mural?: boolean; avisarEmail?: boolean };
  condominio: string;
  limites: { arquivos: number; tamanho: number };
  /** Onde aparece (CD-12, CD-13). */
  canais?: { noMural: boolean; porEmail: boolean; muralLigado: boolean; emailLigado: boolean };
  email?: { total: number; naFila: number; enviados: number; entregues: number; devolvidos: number; spam: number; falharam: number;
    cancelados: number; abertos: number; enviarApos?: string };
  problemas?: { envioId: string; contatoId: string; nome: string; unidades?: string; estado: "DEVOLVIDO" | "SPAM" | "FALHOU";
    motivo?: string; situacaoEmail?: string }[];
}

export interface OpcoesComunicado {
  assuntos: AssuntoComunicado[];
  plano?: string;
  assinatura?: string;
  silencio: { inicio: string; fim: string };
  fuso: string;
  blocos: { id: string; nome: string }[];
  unidades: { id: string; nome: string; blocoId?: string }[];
  contatos?: { id: string; nome: string; unidades: string[] }[];
  pedidos?: { id: string; protocolo: string; assunto: string }[];
  manutencoes?: { id: string; titulo: string; local: string }[];
  pode: { publicar: boolean; verMoradores: boolean };
  agora: string;
  canais?: { muralLigado: boolean; muralAssuntos: AssuntoComunicado[]; emailLigado: boolean };
}

export interface ComunicadosLigados {
  podeVer: boolean;
  podeEscrever: boolean;
  comunicados: ComunicadoResumo[];
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

export type TipoDocumento = "CONVENCAO" | "REGIMENTO" | "ATA" | "CONTRATO" | "LAUDO" | "ORCAMENTO" | "OUTRO";

export interface DocumentoResumo {
  id: string;
  tipo: TipoDocumento;
  titulo: string;
  descricao?: string;
  restrito: boolean;
  aoMorador: boolean;
  valeAte?: string;
  vencendo: boolean;
  vencido: boolean;
  emVigor?: { id: string; numero: number; vigenteDesde: string; aprovadoEm?: string; nome: string };
  proxima?: { id: string; numero: number; vigenteDesde: string };
  arquivadoEm?: string;
  atualizadoEm: string;
  versao: number;
}

export interface ListaDocumentos {
  itens: DocumentoResumo[];
  total: number;
  vencendo: number;
  pode: { editar: boolean; restritos: boolean };
  pedidosEsperando?: number;
}

/** Pedido de documento pelo mural (CD-14). */
export interface PedidoDocumento {
  id: string;
  documentoId: string;
  titulo: string;
  email?: string;
  estado: "ESPERANDO" | "ENVIADO" | "RECUSADO";
  automatico: boolean;
  criadoEm: string;
  decididoEm?: string;
  decididoPor?: string;
  motivo?: string;
  contato?: { id: string; nome: string; unidades?: string };
  abertoEm?: string;
}

export interface PedidosDocumento {
  itens: PedidoDocumento[];
  esperando: number;
  podeDecidir: boolean;
}

export interface EnvioDocumento {
  id: string;
  para: string;
  contato?: string;
  estado: string;
  criadoEm: string;
  abertoEm?: string;
  pedido: boolean;
  numero?: number;
  cancelado: boolean;
  vence?: string;
}

export interface VersaoDocumento {
  id: string;
  numero?: number;
  mudanca?: string;
  vigenteDesde: string;
  aprovadoEm?: string;
  nome: string;
  tipo: string;
  tamanho: number;
  situacao: "ENVIANDO" | "LIBERADO" | "NAO_LIBERADO";
  motivoRecusa?: string;
  enviadoEm: string;
  enviadoPor?: string;
  emVigor?: boolean;
}

export interface DocumentoDetalhe {
  documento: DocumentoResumo & { criadoPor?: string; criadoEm: string; arquivamento?: { motivo: string; em: string; por?: string } };
  versoes: VersaoDocumento[];
  historico: EventoHistorico[];
  pode: { editar: boolean; enviar: boolean; restritos: boolean; enviarEmail?: boolean };
  limites: { tamanho: number };
  hoje: string;
  envios?: EnvioDocumento[];
  contatosComEmail?: { id: string; nome: string; unidades?: string }[];
  vaiPorEmail?: boolean;
}

// ---------------------------------------------------------------------------------------
// Sem conta: o mural e os links do e-mail (CD-12 a CD-14).

export interface ComunicadoPublico {
  id: string;
  assunto: AssuntoComunicado;
  titulo: string;
  texto: string;
  assinatura?: string;
  publicadoEm: string;
  numero: number;
  mudanca?: string;
  arquivos: { id: string; nome: string; tipo: string }[];
}

export interface MuralPublico {
  condominio: string;
  trocado?: boolean;
  foraDoAr?: boolean;
  comunicados?: ComunicadoPublico[];
  documentos?: { id: string; titulo: string; tipo: TipoDocumento }[];
  /** As seções do manual do prédio marcadas "no mural" (peça R10, MP-14). */
  manual?: { id: string; titulo: string; resumo?: string; texto: string; atualizadoEm: string }[];
  atualizadoEm?: string;
}

export interface ResumoComunicados {
  programadosHoje?: number;
  proximoProgramado?: { id: string; titulo: string; em: string };
  rascunhosParados?: number;
  rascunhoMaisAntigo?: { id: string; titulo: string; desde: string };
  documentosVencendo: number;
  documentoMaisProximo?: { id: string; titulo: string; valeAte: string };
}

// ---------------------------------------------------------------------------------------
// Links e QR (peça R13; AT-30, MP-08, V-11).

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

export interface RegistroPrestador {
  id: string;
  tipo: "CHEGOU" | "IMPEDIMENTO" | "TERMINOU";
  confirmado?: boolean;
  impedimento?: "SEM_ACESSO" | "FALTA_PECA" | "OUTRO_SERVICO" | "OUTRO";
  texto?: string;
  ficouPendente?: boolean;
  pendenteTexto?: string;
  quemFez?: string;
  em: string;
  etiqueta?: { rotulo: string; local: string };
  fotos: number;
}

export interface LinkPrestadorInfo {
  link?: {
    id: string; para: string; oQueFazer: string; quando?: string; comoEntrar?: string; expiraEm: string; abertoEm?: string;
    criadoEm: string; criadoPor?: string; situacao: "VALE" | "CANCELADO" | "CONCLUIDA" | "MANUTENCAO_CANCELADA" | "VENCIDO"; motivoCancelamento?: string;
  };
  registros: RegistroPrestador[];
  fotos: { id: string; nome: string; registroId: string; enviadoEm: string }[];
  para?: { nome: string; telefone?: string; email?: string };
  local: string;
  sugestao: { oQueFazer: string };
  etiqueta?: { rotulo: string; local: string };
  arquivos: { id: string; nome: string; tipo: string }[];
  pode: { mandar: boolean; cancelar: boolean };
  semExecutor?: boolean;
}

export interface EtiquetaPublica {
  condominio: string;
  foraDeUso?: boolean;
  local?: string;
  rotulo?: string;
  recado?: string;
  recadoEm?: string;
  whatsapp?: string;
}

export interface PrestadorPublico {
  condominio: string;
  encerrado?: boolean;
  motivo?: "CANCELADO" | "CONCLUIDA" | "MANUTENCAO_CANCELADA" | "VENCIDO";
  para?: string;
  tipo?: "CORRETIVA" | "PREVENTIVA" | "VISTORIA";
  titulo?: string;
  local?: string;
  oQueFazer?: string;
  quando?: string;
  comoEntrar?: string;
  expiraEm?: string;
  arquivos?: { id: string; nome: string; tipo: string }[];
  registros?: { tipo: "CHEGOU" | "IMPEDIMENTO" | "TERMINOU"; confirmado?: boolean; em: string; etiqueta?: string }[];
}

// ---------------------------------------------------------------------------------------
// Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04).

export interface ResumoProntuario {
  total: number;
  emDia: number;
  vence: number;
  venceu: number;
  falta: number;
  naoSeAplica: number;
}

export interface ItemProntuario {
  id?: string;
  chave?: string;
  grupo: "CONSTITUICAO" | "SEGUROS" | "LAUDOS" | "PLANTAS" | "OUTRO";
  nome: string;
  situacao: "EM_DIA" | "VENCE" | "VENCEU" | "FALTA" | "NAO_SE_APLICA";
  avisarDias: number;
  motivo?: string;
  versao?: number;
  valeAte?: string;
  documento?: { id?: string; titulo?: string; tipo?: string; restrito?: boolean; arquivado?: boolean; emVigor?: { numero: number; vigenteDesde: string } };
}

export interface DocumentoOpcao {
  id: string;
  titulo: string;
  tipo: string;
  valeAte?: string | null;
}

export interface Prontuario {
  itens: ItemProntuario[];
  resumo: ResumoProntuario;
  contratos?: { total: number; vencendo: { id: string; prestador: string; ate: string }[] };
  preventivas?: { ativas: number; atrasadas: number };
  documentos: DocumentoOpcao[];
  podeEditar: boolean;
}

export interface EventoMemoria {
  fonte: "ANOTADO" | "MANUTENCAO" | "DOCUMENTO" | "PRONTUARIO" | "COMUNICADO" | "PESSOA";
  categoria: string;
  id: string;
  data: string;
  titulo: string;
  detalhe?: string;
  /** Só na anotação. */
  tipo?: string;
  texto?: string;
  autor?: string;
  corrigida?: boolean;
  versao?: number;
  aconteceuEm?: string;
  ligacao?: { tipo: "DOCUMENTO" | "PEDIDO" | "MANUTENCAO"; id?: string; titulo?: string; protocolo?: string; restrito?: boolean; privado?: boolean };
  manutencaoId?: string;
  documentoId?: string;
}

export interface LinhaDoTempo {
  eventos: EventoMemoria[];
  maisAntigosAntes?: string;
  podeAnotar: boolean;
}

export interface OpcoesMemoria {
  documentos: DocumentoOpcao[];
  pedidos: { id: string; protocolo: string; titulo: string }[];
  manutencoes: { id: string; titulo: string }[];
}

export interface AnotacaoDetalhe {
  anotacao: EventoMemoria & { tipo: string; texto: string; aconteceuEm: string; versao: number };
  versoes: { numero: number; tipo: string; titulo: string; texto: string; aconteceuEm: string; escritaEm: string; autor?: string; substituidaEm: string }[];
  podeEditar: boolean;
}

export interface SecaoManual {
  id: string;
  titulo: string;
  resumo?: string;
  texto: string;
  ordem: number;
  noMural: boolean;
  escritaEm: string;
  autor?: string;
  versoes: number;
  versao: number;
}

export interface Manual {
  secoes: SecaoManual[];
  muralLigado: boolean;
  podeEditar: boolean;
}

export interface Dossie {
  id: string;
  geradoEm: string;
  autor?: string;
  conteudo: {
    condominio: { nome: string; cidade?: string; uf?: string };
    geradoPor?: string;
    pendencias: {
      pedidosAbertos: number;
      pedidos: { protocolo: string; assunto: string; unidade?: string; estado: string; proximoRetorno?: string; retornoVencido?: boolean; responsavel?: string }[];
      manutencoes: { titulo: string; tipo: string; local: string; estado: string; previsao?: string; pendencia?: string; responsavel?: string }[];
      prontuario: { item: string; situacao: ItemProntuario["situacao"]; valeAte?: string }[];
    };
    prestadores: { prestador: string; servico: string; acordo: string; contratoAte?: string; contato?: string; telefone?: string }[];
    documentos: { tipo: string; titulo: string; restrito?: boolean; valeAte?: string; emVigor?: number }[];
    preventivas: { atividade: string; local: string; proxima: string; intervalo: number; unidadeTempo: string }[];
    anotacoes: { tipo: string; titulo: string; texto: string; aconteceuEm: string }[];
    agenda: { titulo: string; tipo: string; data: string; hora?: string; local?: string }[];
    comunicados: { titulo: string; assunto: string; publicadoEm: string }[];
    acesso: { pessoa: string; funcao: string; cargo?: string; desde: string; permissoes?: string[] }[];
    manual: { titulo: string; texto: string; noMural?: boolean }[];
    resumoProntuario: ResumoProntuario;
  };
}

export interface Exportacao {
  id: string;
  situacao: "MONTANDO" | "PRONTA" | "VENCIDA" | "FALHOU";
  pedidaEm: string;
  autor?: string;
  prontaEm?: string;
  expiraEm?: string;
  erro?: string;
  partes: { numero: number; tipo: "DADOS" | "ARQUIVOS"; situacao: string; tamanho?: number; arquivos?: number }[];
}

export interface Exportacoes {
  exportacoes: Exportacao[];
  podePedir: boolean;
  motivo?: "MONTANDO" | "UMA_POR_DIA";
  montando: boolean;
}

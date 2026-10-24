// O que a API da Plataforma devolve nas configurações (plataforma_configuracoes), nas
// pessoas (plataforma_pessoas), nos moradores e unidades (passo 3) e nos pedidos (passo 4).

import type {
  CanalEnquete, ConfirmacaoArea, EscopoEnquete, EstadoReserva, Ligacao, ModoArea, Ocupacao, Parentesco, PeriodoLimite, SituacaoEnquete,
  EstadoAssembleia, EstadoItem, EstadoProcuracao, FormaAssembleia, PesoAssembleia, Quorum, SituacaoItem, TipoAssembleia, TipoItem,
  EstadoAnuncio, TipoAnuncio, TipoVeiculo, DecisaoQueda, EstadoQueda, AvisoNovoSindico, DestinoAvisoRegistro, MeioAvisoRegistro,
  EstadoDecisao, FiltroDecisao, TipoLigacao, SituacaoLinkRegistro, MotivoForaDoMural,
  Aniversario, CategoriaHistorico, Especie, ParentescoFamiliar, Porte,
  FamiliarCadastro, LigacaoCadastro, MotivoRecusaCadastro, PedidoLink, PetCadastro, VeiculoCadastro, OrdemPedidos,
} from "@triade/domain";


// As configurações moram com as telas delas (@triade/configuracoes), que o Console também usa.
import type { AreaComumTela } from "@triade/configuracoes";
export type { Configuracoes, RegrasAviso, PlanoComunicacao, Etiqueta, LinksQr, EtiquetaDetalhe, AreaComumTela, AreasComuns, Recado, ComunicadosWhatsapp }
  from "@triade/configuracoes";

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
  /** MU-11: marcada à venda e para alugar. */
  aVenda: boolean;
  paraAlugar: boolean;
  /** F3.9, F3.10 (MU-06, MU-11): pets e família na unidade e aniversariantes do mês (etiquetas da busca). */
  pets?: number;
  familia?: number;
  aniversariantesMes?: number;
  /** F3.10 (MU-09): cadastros pelo link esperando conferência (já somados em pendentes). */
  cadastrosLink?: number;
}

export interface Unidades {
  estrutura: Estrutura;
  blocos: Bloco[];
  unidades: UnidadeResumo[];
  resumo: { unidades: number; semContato: number; aConfirmar: number; semProprietario: number };
  /** Contadores do topo da lista (passo 3b, MU-11). */
  ocupacao: { comMorador: number; alugadas: number; proprietarioNaoMora: number; semResponsavel: number; aVenda: number; paraAlugar: number };
  podeEditar: boolean;
  podeConfirmar: boolean;
  /** O mês de hoje no condomínio, para a etiqueta Aniversariante do mês. */
  mes?: number;
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
  /** Comunicado pelo WhatsApp do condomínio (CD-02, F6.6): a escolha vale para o telefone. */
  comunicadosWhatsapp?: SituacaoComunicadosWhatsapp;
  comunicadosWhatsappEm?: string;
  comunicadosWhatsappOrigem?: "PERGUNTA" | "COMANDO";
  /** Só dia e mês (decisão B de 23/10/2026). */
  aniversario?: Aniversario;
}

export type SituacaoComunicadosWhatsapp = "ACEITOU" | "RECUSOU" | "PAROU" | "SEM_RESPOSTA";

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
  unidade: {
    id: string; identificacao: string; blocoId: string | null; andar: string | null; bloco: string | null; ativa: boolean; versao: number;
    /** MU-11: desde quando está à venda e para alugar; nulo quando não está. */
    aVendaDesde: string | null; paraAlugarDesde: string | null;
  };
  contatos: ContatoDaUnidade[];
  anteriores: ContatoAnterior[];
  ocupacao: { situacao: Ocupacao; moram: number; proprietarioNaoMora: boolean };
  faltaProprietario: boolean;
  podeEditar: boolean;
  podeConfirmar: boolean;
  emailLigado?: boolean;
  comunicadosWhatsappLigado?: boolean;
  /** Garagens e veículos (MU-06): as vagas da unidade e os veículos em uso. */
  vagas?: Vaga[];
  veiculos?: Veiculo[];
  /** Família, pets e as três últimas mudanças (F3.9, F3.10). */
  familia?: Familiar[];
  pets?: Pet[];
  historico?: ItemHistoricoUnidade[];
}

/** Vaga de garagem (MU-06): da unidade ou do condomínio. */
export interface Vaga {
  id: string;
  identificacao: string;
  onde?: string;
  coberta?: boolean;
  unidadeId?: string;
  unidade?: string;
  ativa: boolean;
  versao: number;
  veiculos: { id: string; placa: string; tipo: TipoVeiculo; modelo?: string }[];
}

/** Veículo em uso na unidade (MU-06). A placa vem pronta para mostrar. */
export interface Veiculo {
  id: string;
  placa: string;
  tipo: TipoVeiculo;
  modelo?: string;
  unidadeId: string;
  contatoId?: string;
  contato?: string;
  vagaId?: string;
  vaga?: string;
  versao: number;
}

export interface Garagens {
  vagas: Vaga[];
  /** Os veículos que não estão numa vaga, com a unidade (decisão B.2). */
  semVaga?: (Veiculo & { unidade: string })[];
  resumo: { vagas: number; deUnidades: number; doCondominio: number; veiculos: number; semVaga: number };
  unidades: { id: string; nome: string }[];
  podeEditar: boolean;
}

/** O que a busca da lista de unidades achou em cada unidade (MU-11). */
export interface AchadoUnidade {
  unidadeId: string;
  tipo: "UNIDADE" | "PLACA" | "NOME" | "TELEFONE" | "FAMILIA";
  texto: string;
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
  /** Se mora na unidade (0292); antes dela, não vem. */
  mora?: boolean;
  estado: "PENDENTE" | "CONFIRMADO";
  origem: "PAINEL" | "PLANILHA";
  versao: number;
  emailSituacao?: "PENDENTE" | "CONFIRMADO" | "DEVOLVIDO" | "PAROU";
  comunicadosWhatsapp?: SituacaoComunicadosWhatsapp;
}

export interface ListaMoradores {
  itens: MoradorDaLista[];
  total: number;
  pagina: number;
  porPagina: number;
  aConfirmar: number;
  /** A aba escolhida e o número de cada uma, já com a busca e o atalho (decisão B.1). */
  ligacao?: "PROPRIETARIOS" | "INQUILINOS" | "MORAM";
  ligacoes?: { todas: number; proprietarios: number; inquilinos: number; moram: number };
  /** Contatos sem e-mail confirmado (CD-13). */
  semEmail?: number;
  /** Contatos que não recebem comunicado pelo WhatsApp (F6.6). */
  semWhatsapp?: number;
  comunicadosWhatsappLigado?: boolean;
  podeEditar: boolean;
  podeConfirmar: boolean;
  /** Quando a lista é de uma unidade só (Pendentes do menu da unidade). */
  unidade?: { id: string; nome: string };
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


/** Um aviso dentro do painel (passo 6, F6.1). Assunto vazio: pedido privado que a pessoa não vê. */
export interface AvisoDoPainel {
  id: string;
  tipo: "RETORNO_VENCIDO" | "ESCALADO_SINDICO" | "ESCALADO_SUBSTITUTO" | "SEM_RESPONSAVEL" | "PENDENCIA_PARADA" | "MANUTENCAO_RETORNO_VENCIDO"
    | "DOCUMENTO_VENCENDO" | "DOCUMENTO_PEDIDO" | "EMAIL_DEVOLVIDO" | "EMAIL_SPAM" | "PRESTADOR_IMPEDIMENTO" | "PRESTADOR_TERMINOU"
    | "PRONTUARIO_VENCE" | "PRONTUARIO_VENCEU" | "EXPORTACAO_PRONTA" | "EXPORTACAO_FALHOU"
    | "ENTREGA" | "CHAMADO_RESPOSTA" | "ACESSO_PEDIDO" | "CONFIGURACAO"
    | "WHATSAPP_PEDIDO_NOVO" | "WHATSAPP_REVISAO" | "WHATSAPP_A_IDENTIFICAR" | "WHATSAPP_FALHA_ENVIO" | "WHATSAPP_DESCONECTADO"
    | "RESERVA_A_APROVAR" | "RESERVA_CANCELADA"
    | "PRESTADOR_CONFIRMOU" | "PRESTADOR_RECUSOU" | "WHATSAPP_QUEDA" | "WHATSAPP_QUEDA_VOLTOU"
    | "TROCA_TROCOU" | "TROCA_MANDAR_LINK" | "TROCA_NAO_TROCOU" | "TROCA_RESERVA_SEM_RESPOSTA" | "TROCA_SEM_RESPOSTA"
    | "DECISAO_PEDIDA" | "DECISAO_VENCIDA" | "DECISAO_RESPONDIDA";
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
  /** Nos avisos da TRÍADE (peça R4): o recado da entrega, o chamado respondido, o pedido de acesso. */
  texto?: string;
  chamadoId?: string;
  numero?: number;
  acessoId?: string;
  responsavel?: string | null;
  referencia?: string;
  /** Nos avisos das reservas (peça R12). */
  reservaId?: string;
  /** Nos avisos das decisões (F7.4, AT-23): o título é a pergunta; prazo e situação de agora. */
  decisaoId?: string;
  prazo?: string;
  estado?: EstadoDecisao;
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
  /** Pendências de agora por responsável (TR-01); sem responsável vem com id e nome nulos, no fim. */
  pendencias: { responsavelId: string | null; nome: string | null; abertos: number; retornoVencido: number; maisAntigoDias: number }[];
  /** Tempo de solução por categoria no período (TR-01), em horas corridas; sem pedido concluído, sem número. */
  solucao: { categoriaId: string; nome: string; concluidos: number; medianaHoras: number | null; maisDemoradoHoras: number | null }[];
  /** Reincidência no período (F7.4, TR-01, AT-18); sem pedido no período, porcentagem nula. */
  reincidencia?: {
    pedidos: number;
    reincidencias: number;
    porcentagem: number | null;
    ondeVolta: { onde: string | null; categoria: string; vezes: number; ultima: string }[];
  };
  /** Decisões aguardando o síndico (F7.4, AT-23): aguardando é de agora; o resto, do período. */
  decisoes?: {
    aguardando: number;
    vencidas: number;
    maisAntigaDias: number | null;
    decididas: number;
    aprovadas: number;
    devolvidas: number;
    medianaHoras: number | null;
  };
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
  /** A ordem guardada na pessoa (0289); a API antiga não manda. */
  ordem?: OrdemPedidos;
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
    registradoPor: string | null;
    encerradoEm: string | null;
    cancelamento: { em: string; motivo: string; por: string } | null;
    /** O prestador avisado no registro (F6.4). */
    prestador?: { id: string; nome: string };
  };
  /** Quem foi avisado no registro e em que pé está cada envio (F6.4, AT-26). */
  avisosRegistro: AvisoDoRegistro[];
  pendencias: PendenciaPedido[];
  andamentos: { id: string; tipo: "RETORNO" | "NOTA"; meio: string | null; texto: string; em: string; autor: string }[];
  conclusoes: ConclusaoPedido[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  /** Pedidos relacionados (F7.4, AT-18): os ligados e os parecidos sugeridos na janela de dias. Opcionais até a
   * API nova estar publicada. */
  relacionados?: { ligados: LigacaoPedido[]; parecidos: PedidoParecido[]; dias: number };
  /** Decisões pedidas ao síndico neste pedido (F7.4, AT-23), da mais nova para a mais antiga. */
  decisoes?: DecisaoPedido[];
  /** Quem pode decidir: o síndico e quem tem a permissão Aprovar. */
  decisores?: { vinculoId: string; nome: string; sindico: boolean; eu: boolean }[];
  pode: {
    responder: boolean; atualizar: boolean; concluir: boolean; revisar: boolean; aceitar: boolean; repassar: boolean; ligar?: boolean; pedirDecisao?: boolean;
  };
  regras: { revisao: boolean; reabertura: boolean };
  agora: string;
}

/** Um pedido parecido, sugerido para ligar (AT-18). */
export interface PedidoParecido {
  id: string;
  protocolo: string;
  assunto: string;
  estado: EstadoPedido;
  versao: number;
  categoria: string;
  onde: string | null;
  abertoEm: string;
  encerradoEm: string | null;
  /** O antigo foi concluído antes de o novo abrir. */
  podeReincidencia: boolean;
}

/** Uma ligação, vista deste pedido: NOVO é o ligado ao outro; ANTIGO é o outro lado. */
export interface LigacaoPedido {
  id: string;
  tipo: TipoLigacao;
  papel: "NOVO" | "ANTIGO";
  pedido: { id: string; protocolo: string; assunto: string; estado: EstadoPedido; abertoEm: string; encerradoEm?: string };
  motivo: string;
  em: string;
  por?: string;
}

export interface AlternativaDecisao {
  numero: number;
  descricao: string;
  detalhe?: string;
  /** Custo estimado em centavos. */
  custo?: number;
  moeda?: string;
}

/** Decisão pedida ao síndico (AT-23). Campos vazios não vêm. */
export interface DecisaoPedido {
  id: string;
  versao: number;
  estado: EstadoDecisao;
  pendenciaId: string;
  pergunta: string;
  porque?: string;
  prazo: string;
  vencida: boolean;
  decisor: { vinculoId: string; nome: string; eu: boolean };
  pedidaEm: string;
  pedidaPor?: string;
  respondidaEm?: string;
  respondidaPor?: string;
  alternativaAprovada?: number;
  justificativa?: string;
  retiradaMotivo?: string;
  alternativas: AlternativaDecisao[];
  pedido: { id: string; protocolo: string; assunto: string; estado: EstadoPedido };
  pode: { responder: boolean; retirar: boolean };
}

export interface ListaDecisoes {
  decisoes: DecisaoPedido[];
  aguardandoEu: number;
  filtro: FiltroDecisao;
  /** Hoje no fuso do condomínio, para o prazo. */
  hoje: string;
  pode: { aprovar: boolean };
}

// Aviso de pedido registrado (F6.4, AT-26).

/** Uma linha do que saiu no registro: na confirmação e no cartão do pedido. */
export interface AvisoDoRegistro {
  destino: DestinoAvisoRegistro;
  meio: MeioAvisoRegistro;
  nome?: string;
  /** NO_SINO, NA_CONVERSA ou o estado do envio (W-13), do e-mail ou do comunicado. */
  situacao?: string;
  enviarApos?: string;
  parado?: boolean;
  motivo?: string;
  entregueEm?: string;
  lidoEm?: string;
  vistoEm?: string;
  comunicadoId?: string;
  destinatarios?: number;
  noMural?: boolean;
  emails?: number;
  /** Mensagens do comunicado pelo WhatsApp (F6.6). */
  whatsapps?: number;
  pelaRegra?: boolean;
  editado?: boolean;
  em: string;
  /** O link do serviço mandado no registro (F6.7) e a manutenção que nasceu com ele. */
  link?: LinkDoRegistro;
}

export interface LinkDoRegistro {
  manutencaoId: string;
  titulo: string;
  estadoManutencao: string;
  situacao: SituacaoLinkRegistro;
  responderAte?: string;
  horas?: number;
  respondidoEm?: string;
  reserva?: { nome: string };
  paraReserva?: string;
}

export interface PessoaAvisada { id: string; nome: string; voceMesmo: boolean; whatsapp: boolean }

/** O bloco Quem avisar, antes de registrar (plataforma_quem_avisar). */
export interface QuemAvisar {
  quemPediu: { contatoId?: string; nome?: string; meio?: "WHATSAPP" | "EMAIL"; marcado: boolean; motivo?: "SEM_CONTATO" | "SEM_MEIO"; mensagem?: string };
  responsavel: { semResponsavel: boolean; pessoas: PessoaAvisada[] };
  sindico: { pelaRegra: boolean; regra: AvisoNovoSindico; pessoas: PessoaAvisada[] };
  prestador: {
    disponivel: boolean; motivo?: "PRIVADO"; rascunho: string; cabecalho: string; rodape: string; textoComDadoDeMorador?: boolean;
    escolhido?: {
      id: string; nome: string; meio?: "WHATSAPP" | "EMAIL";
      /** Por onde vai o link do serviço (F6.7) e a reserva ativa do cadastro. */
      meioLink?: "WHATSAPP" | "EMAIL"; paraLink?: string; reserva?: { id: string; nome: string };
    };
    /** O link do serviço no registro (F6.7): se pode, a validade e o prazo padrão e a prévia da mensagem. */
    link: { disponivel: boolean; motivo?: "PRIVADO" | "SEM_PERMISSAO"; valeAte: string; responderHoras: 4 | 8 | 24 | 48; mensagem: string };
  };
  moradores: {
    disponivel: boolean; motivo?: "PRIVADO" | "SEM_PERMISSAO"; rascunho: { titulo: string; texto: string }; publico: "TODOS" | "BLOCOS";
    blocos?: string[]; textoComDadoDeMorador?: boolean;
    /** O comunicado sai também pelo WhatsApp de quem aceitou (F6.6). */
    whatsapp?: boolean;
  };
  prestadores: { id: string; nome: string; servico: string; acordo: string; contratoAte?: string; reserva?: string; meio?: "WHATSAPP" | "EMAIL"; meioLink?: "WHATSAPP" | "EMAIL"; para?: string; temCelular: boolean; temEmail: boolean }[];
  blocos: { id: string; nome: string; unidades: number }[];
  totalUnidades: number;
  condominio: string;
  regra: { sindico: AvisoNovoSindico; protocolo: boolean };
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
  fonte: "FERIADO" | "PREVENTIVA" | "RESERVA" | "CONTRATO" | "DOCUMENTO" | "ASSEMBLEIA";
  /** Na preventiva, na reserva, no contrato (o prestador), no documento e na assembleia, o id dela. */
  id?: string;
  /** No documento (AG-09): se é restrito. */
  restrito?: boolean;
  /** Na assembleia (AG-09, AC-02): a 2ª chamada, o local e a situação. */
  segundaChamada?: string;
  local?: string;
  estado?: "CONVOCADA" | "EM_ANDAMENTO";
  /** Na reserva confirmada (peça R12, AG-09): o horário e quem pediu. */
  horaInicio?: string;
  horaFim?: string;
  quem?: string;
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
  /** As áreas comuns ativas (peça R12), sugeridas no campo Qual área. */
  areas?: string[];
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
  /** A reserva confirmada da área (peça R12): o id é da reserva, não de um compromisso. */
  reserva?: boolean;
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
  quem?: { contatoId: string; nome: string; unidades: string[]; email?: boolean; whatsapp?: boolean }[];
  /** Quantos recebem por e-mail (e-mail confirmado e sem ter parado). */
  comEmail?: number;
  /** Quantos aceitaram receber pelo WhatsApp e quantos recebem pelos dois (F6.6). */
  comWhatsapp?: number;
  pelosDois?: number;
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
  pode: { editar: boolean; corrigir: boolean; arquivar: boolean; enviar: boolean; copiar: boolean; mural?: boolean; avisarEmail?: boolean;
    avisarWhatsapp?: boolean };
  condominio: string;
  limites: { arquivos: number; tamanho: number };
  /** Onde aparece (CD-12, CD-13). */
  canais?: { noMural: boolean; porEmail: boolean; muralLigado: boolean; emailLigado: boolean;
    porWhatsapp?: boolean; whatsappLigado?: boolean; whatsappConectado?: boolean };
  email?: { total: number; naFila: number; enviados: number; entregues: number; devolvidos: number; spam: number; falharam: number;
    cancelados: number; abertos: number; enviarApos?: string };
  /** Comunicado pelo WhatsApp (F6.6). */
  whatsapp?: { total: number; naFila: number; enviadas: number; entregues: number; lidas: number; falharam: number;
    canceladas: number; abertos: number; saiAte?: string; parados?: number };
  problemas?: { envioId: string; contatoId: string; nome: string; unidades?: string; canal?: "EMAIL" | "WHATSAPP";
    estado: "DEVOLVIDO" | "SPAM" | "FALHOU" | "DESCONHECIDO" | "CANCELADA"; motivo?: string; situacaoEmail?: string }[];
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
  canais?: { muralLigado: boolean; muralAssuntos: AssuntoComunicado[]; emailLigado: boolean;
    whatsappLigado?: boolean; whatsappConectado?: boolean };
}


export interface ComunicadosLigados {
  podeVer: boolean;
  podeEscrever: boolean;
  comunicados: ComunicadoResumo[];
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
  /** O número do condomínio para o botão "Receber pelo WhatsApp" (F6.6), quando os comunicados por lá estão ligados. */
  comunicadosWhatsapp?: string;
  trocado?: boolean;
  foraDoAr?: boolean;
  /** Enquanto o WhatsApp do condomínio está fora do ar (W-17). */
  canalAlternativo?: string;
  comunicados?: ComunicadoPublico[];
  documentos?: { id: string; titulo: string; tipo: TipoDocumento }[];
  /** As seções do manual do prédio marcadas "no mural" (peça R10, MP-14). */
  manual?: { id: string; titulo: string; resumo?: string; texto: string; atualizadoEm: string }[];
  /** As enquetes abertas marcadas para o mural; responde-se pelo link pessoal (AC-03). */
  enquetes?: { id: string; pergunta: string; opcoes: string[]; abertaAte: string; por: EscopoEnquete; secreta: boolean }[];
  /** Os anúncios dos moradores no mural, por 30 dias (AC-05). Primeiro nome e bloco; WhatsApp só com o SIM. */
  classificados?: AnuncioPublico[];
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
    /** Troca automática para a reserva (MP-09). */
    responderAte?: string; responderHoras?: number; respondidoEm?: string; resposta?: "CONFIRMOU" | "RECUSOU" | "CHEGOU";
    reserva?: { id: string; nome: string }; trocaDesligadaEm?: string; trocaResultado?: "TROCOU" | "NAO_TROCOU"; trocadoEm?: string;
    trocaDe?: { nome: string };
    /** Mandado no registro do pedido (F6.7): o prazo só começa quando a mensagem sai. */
    prazoNoEnvio?: number; reservaNoEnvio?: { id: string; nome: string };
    noRegistro?: { pedidoId: string; protocolo: string; meio: "WHATSAPP" | "EMAIL" };
  };
  /** A reserva do cadastro de quem executa, para oferecer o prazo ao mandar o link (MP-09). */
  reservaDoCadastro?: { id: string; nome: string };
  registros: RegistroPrestador[];
  fotos: { id: string; nome: string; registroId: string; enviadoEm: string }[];
  para?: { nome: string; telefone?: string; email?: string };
  local: string;
  sugestao: { oQueFazer: string };
  etiqueta?: { rotulo: string; local: string };
  arquivos: { id: string; nome: string; tipo: string }[];
  pode: { mandar: boolean; cancelar: boolean; naoTrocar?: boolean };
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
  /** Enquanto o WhatsApp do condomínio está fora do ar (W-17). */
  canalAlternativo?: string;
  /** Etiqueta de área comum que aceita reserva (peça R12, W-22): leva ao RESERVAR. */
  reserva?: { area: string; capacidade?: number; horario: string; livres?: string[]; texto: string };
}

export interface PrestadorPublico {
  condominio: string;
  encerrado?: boolean;
  motivo?: "CANCELADO" | "CONCLUIDA" | "MANUTENCAO_CANCELADA" | "VENCIDO" | "REPASSADO";
  /** Até quando confirmar, antes de passar para a reserva (MP-09); e a resposta já dada. */
  responderAte?: string;
  resposta?: "CONFIRMOU" | "RECUSOU" | "CHEGOU";
  para?: string;
  /** O número do pedido de onde veio a manutenção (F6.7). */
  pedido?: string;
  tipo?: "CORRETIVA" | "PREVENTIVA" | "VISTORIA";
  titulo?: string;
  local?: string;
  oQueFazer?: string;
  quando?: string;
  comoEntrar?: string;
  expiraEm?: string;
  arquivos?: { id: string; nome: string; tipo: string }[];
  registros?: { tipo: "CHEGOU" | "IMPEDIMENTO" | "TERMINOU" | "CONFIRMOU" | "RECUSOU"; confirmado?: boolean; em: string; etiqueta?: string }[];
}

// ---------------------------------------------------------------------------------------
// Queda do WhatsApp (F5.10; W-17).

export interface EnvioDaQueda {
  id: string;
  finalidade: string;
  estado: string;
  criadoEm: string;
  texto: string;
  automatica: boolean;
  por?: string;
  para?: string;
  unidades?: string;
  pedido?: { id: string; protocolo: string };
  parada: boolean;
  conciliacao?: DecisaoQueda;
  conciliacaoMotivo?: string;
  conciliadaPor?: string;
}

export interface QuedaWhatsapp {
  id: string;
  estado: EstadoQueda;
  origem: "PROVEDOR" | "MANUAL";
  inicio: string;
  voltouEm?: string;
  encerradaEm?: string;
  responsavel?: string;
  souResponsavel?: boolean;
  canalAlternativo?: string;
  oQueAconteceu?: string;
  resumo?: string;
  abertaPor?: string;
  encerradaPor?: string;
  versao: number;
  paradas: number;
  faltam: number;
  atrasadas: number;
  outroCanal: number;
  envios?: EnvioDaQueda[];
  historico?: { acao: string; em: string; autor?: string; dados: Record<string, unknown> }[];
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
  fonte: "ANOTADO" | "MANUTENCAO" | "DOCUMENTO" | "PRONTUARIO" | "COMUNICADO" | "PESSOA" | "ASSEMBLEIA";
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

// ---------------------------------------------------------------------------------------
// Vida em condomínio (peça R12): áreas comuns e reservas.



export interface OcupacaoArea {
  motivo: "RESERVA" | "AGENDA";
  id: string;
  titulo: string;
}

export interface ReservaTela {
  id: string;
  protocolo: string;
  area: { id: string; nome: string; reserva: ConfirmacaoArea };
  unidade: { id: string; nome: string };
  contato?: { id: string; nome: string };
  data: string;
  horaInicio: string;
  horaFim: string;
  estado: EstadoReserva;
  origem: "WHATSAPP" | "PAINEL";
  tolerancia: boolean;
  observacao?: string;
  criadoEm: string;
  registradoPor?: string;
  decisao?: { em: string; por?: string; motivo?: string; peloMorador?: boolean };
  versao: number;
  outrosPedidos?: number;
  ocupacao?: OcupacaoArea;
  limite?: { n: number; quantidade: number; periodo: PeriodoLimite };
}

export interface ListaReservas {
  reservas: ReservaTela[];
  aAprovar: number;
  areas: { id: string; nome: string; ativa: boolean; reserva: ConfirmacaoArea; modo: ModoArea }[];
  hoje: string;
  pode: { editar: boolean };
}

export interface SemanaArea {
  area: AreaComumTela;
  dias: {
    data: string;
    reservas: { id: string; protocolo: string; estado: EstadoReserva; unidade: string; horaInicio: string }[];
    bloqueios: { id: string; titulo: string; horaInicio: string | null; horaFim: string | null }[];
  }[];
  hoje: string;
}

export interface ReservaDetalhe {
  reserva: ReservaTela;
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  mensagens: { id: string; estado: string; em: string; motivo: string | null }[];
  pode: { editar: boolean };
}

export interface OpcoesReserva {
  areas: AreaComumTela[];
  unidades: { id: string; nome: string; contatos: { id: string; nome: string }[] }[];
  hoje: string;
}

export interface ConferenciaReserva {
  blocos?: string[];
  conferencia: { erro?: "FORA_DO_PRAZO" | "HORARIO" | "OCUPADA" | "LIMITE"; ocupacao?: OcupacaoArea; inicio?: string; fim?: string; tolerancia?: boolean };
  noPeriodo?: number;
  proxima?: string;
}

export interface ResumoVida {
  reservasAAprovar: number;
  proximasAAprovar: { data: string; area: string; pedidos: number }[];
  /** As enquetes abertas, com quantos responderam (AC-03). Só para quem vê as enquetes. */
  enquetesAbertas?: { id: string; pergunta: string; abertaAte: string; responderam: number; total: number }[];
  /** A próxima assembleia convocada ou em andamento (AC-02). Só para quem vê as assembleias. */
  assembleia?: { id: string; titulo: string; estado: EstadoAssembleia; primeiraChamada: string; procuracoesPendentes: number };
  /** Os anúncios esperando aprovação (AC-05). Só para quem vê os classificados. */
  classificadosAAprovar?: number;
}

// Enquetes (AC-03).
export interface ResultadoEnquete {
  opcoes: { texto: string; votos: number }[];
  responderam: number;
  total: number;
}

export interface EnqueteTela {
  id: string;
  pergunta: string;
  opcoes: string[];
  por: EscopoEnquete;
  secreta: boolean;
  abertaAte: string;
  canais: CanalEnquete[];
  lembreteEm?: string;
  lembreteEnviadoEm?: string;
  situacao: SituacaoEnquete;
  encerradaEm?: string;
  encerradaPor?: string;
  comunicado?: { id: string; estado: string };
  criadoEm: string;
  criadoPor?: string;
  versao: number;
  resultado: ResultadoEnquete;
}

export interface ListaEnquetes {
  enquetes: EnqueteTela[];
  canais: { whatsapp: boolean; email: boolean; mural: boolean };
  unidades: number;
  pode: { editar: boolean };
}

export interface ConviteEnquete {
  id: string;
  nome: string;
  respondeuEm?: string;
  /** A escolha, só na enquete aberta (não secreta). */
  opcao?: number;
  semContato?: boolean;
}

export interface EnqueteDetalhe {
  enquete: EnqueteTela;
  convites: ConviteEnquete[];
  historico: { acao: string; em: string; autor?: string; dados: Record<string, unknown> }[];
  pode: { editar: boolean };
}

/** O que o link pessoal mostra (AC-03). */
export interface EnquetePublica {
  condominio: string;
  pergunta: string;
  opcoes: string[];
  por: EscopoEnquete;
  secreta: boolean;
  abertaAte: string;
  aberta: boolean;
  para: string;
  respondeuEm?: string;
  escolha?: number;
  resultado?: ResultadoEnquete;
}

// Assembleias (AC-02).
export interface ResultadoItem {
  opcoes: { texto: string; votos: number; peso: number; porcentagem: number }[];
  votaram: number;
  presentes: number;
  pesoPresentes: number;
  pesoTotal: number;
  porcentagemPresentes: number;
  situacao: SituacaoItem;
  vencedor?: string;
  alcancavel: boolean;
  validos: number;
}

export interface ItemAssembleia {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  tipo: TipoItem;
  opcoes: string[];
  quorum: Quorum;
  estado: EstadoItem;
  abertoEm?: string;
  encerradoEm?: string;
  resultado: ResultadoItem;
}

export interface PresencaAssembleia {
  unidades: number;
  presentes: number;
  online: number;
  salao: number;
  porProcuracao: number;
  procuracoesPendentes: number;
  semDireito: number;
  porcentagem: number;
}

export interface AssembleiaTela {
  id: string;
  titulo: string;
  tipo: TipoAssembleia;
  forma: FormaAssembleia;
  primeiraChamada: string;
  segundaChamada: string;
  local?: string;
  linkVideo?: string;
  estado: EstadoAssembleia;
  peso: PesoAssembleia;
  antecedencia: number;
  enviarAte: string;
  convocadaEm?: string;
  convocadaPor?: string;
  comunicadoId?: string;
  iniciadaEm?: string;
  encerradaEm?: string;
  canceladaEm?: string;
  motivoCancelamento?: string;
  ataTexto?: string;
  ataDocumento?: { id: string; titulo: string };
  itens: ItemAssembleia[];
  presenca?: PresencaAssembleia;
  criadoEm: string;
  versao: number;
}

export interface AssembleiaResumo {
  id: string;
  titulo: string;
  tipo: TipoAssembleia;
  forma: FormaAssembleia;
  estado: EstadoAssembleia;
  primeiraChamada: string;
  itens: number;
  presentes: number;
  unidades: number;
  procuracoesPendentes: number;
}

export interface ListaAssembleias {
  assembleias: AssembleiaResumo[];
  regras: { antecedencia: number; peso: PesoAssembleia; versao: number };
  semFracao: number;
  unidades: number;
  pode: { editar: boolean; configurar: boolean; fracoes: boolean };
}

export interface UnidadeAssembleia {
  id: string;
  unidade: string;
  peso: number;
  semDireito: boolean;
  motivoSemDireito?: string;
  procuracao?: { estado: EstadoProcuracao; nome: string; em: string; motivo?: string; unidade?: string };
  presenteEm?: string;
  presencaForma?: "ONLINE" | "SALAO";
  proprietarios?: string;
  semContato: boolean;
  votos?: Record<string, number>;
}

export interface AssembleiaDetalhe {
  assembleia: AssembleiaTela;
  unidades: UnidadeAssembleia[];
  documentos: { id: string; titulo: string }[];
  historico: { acao: string; em: string; autor: string | null; dados: Record<string, unknown> }[];
  pode: { editar: boolean };
}

export interface Fracoes {
  unidades: { id: string; nome: string; fracao?: number; versao: number }[];
  soma: number;
  pode: { editar: boolean };
}

export interface AssembleiaPublica {
  condominio: string;
  titulo: string;
  tipo: TipoAssembleia;
  forma: FormaAssembleia;
  estado: EstadoAssembleia;
  primeiraChamada: string;
  segundaChamada: string;
  local?: string;
  linkVideo?: string;
  peso?: PesoAssembleia;
  motivoCancelamento?: string;
  unidade: string;
  proprietarios?: string;
  semDireito: boolean;
  procuracao?: { estado: EstadoProcuracao; nome: string; motivo?: string; unidade?: string };
  representa?: string[];
  outrasUnidades?: { id: string; nome: string }[];
  presenteEm?: string;
  itens: { id: string; ordem: number; titulo: string; descricao?: string; opcoes: string[]; estado: EstadoItem; quorum: Quorum; meuVoto?: number; resultado?: ResultadoItem }[];
}

// Classificados entre moradores (AC-05).
export interface AnuncioTela {
  id: string;
  tipo: TipoAnuncio;
  texto: string;
  estado: EstadoAnuncio;
  titulo?: string;
  valorCentavos?: number;
  noMuralAte?: string;
  tituloSugerido: string;
  valorSugerido?: number;
  mostrarTelefone: boolean;
  foto: boolean;
  unidade: { id: string; nome: string };
  contato?: { id: string; nome: string };
  criadoEm: string;
  decisao?: { em: string; por?: string };
  retirada?: { em: string; por?: string };
  motivo?: string;
  versao: number;
}

export interface ListaAnuncios {
  classificados: AnuncioTela[];
  aAprovar: number;
  pode: { editar: boolean };
}

export interface AnuncioPublico {
  id: string;
  tipo: TipoAnuncio;
  titulo: string;
  texto: string;
  valorCentavos?: number;
  /** Quando entrou no mural, para a vitrine mostrar há quanto tempo (CD-15). */
  desde?: string;
  ate: string;
  foto: boolean;
  quem?: string;
  bloco?: string;
  whatsapp?: string;
}

/** O mural visto do painel (CD-15): o mesmo do link, sem contar abertura, e o que ficou de fora. */
export interface MuralNoPainel {
  ligado: boolean;
  codigo?: string;
  aberturas: number;
  mural?: MuralPublico;
  /** A versão de cada aviso que está no mural, para tirar dali mesmo. */
  versoes: Record<string, number>;
  fora: { id: string; titulo: string; assunto: AssuntoComunicado; publicadoEm: string; versao: number; motivo: MotivoForaDoMural }[];
  pode: { mural: boolean; configurar: boolean; classificados: boolean };
}

/** Quem é da família (MU-06): sem telefone e sem acesso. */
export interface Familiar {
  id: string;
  nome: string;
  parentesco: ParentescoFamiliar;
  mora: boolean;
  aniversario?: Aniversario;
  desde: string;
  versao: number;
}

export interface Pet {
  id: string;
  nome: string;
  especie: Especie;
  porte?: Porte;
  raca?: string;
  observacao?: string;
  desde: string;
  versao: number;
}

/** Um registro do histórico da unidade (MU-11), já escrito pelo banco; sem telefone nem placa. */
export interface ItemHistoricoUnidade {
  id: number;
  em: string;
  categoria?: CategoriaHistorico | "UNIDADE";
  titulo: string;
  detalhe?: string;
  autor: string;
}

export interface HistoricoUnidade {
  unidade: string;
  itens: ItemHistoricoUnidade[];
  mais: boolean;
  total: number;
  desde: string | null;
}

export interface Aniversariantes {
  mes: number;
  mesAtual: number;
  itens: { tipo: "PESSOA" | "FAMILIA"; id: string; nome: string; dia: number; descricao: string; unidadeId: string; unidade: string }[];
  unidades: { id: string; nome: string }[];
}

/** Link de cadastro da unidade ou do prédio (F3.10; MU-09). O código só vem na hora de criar. */
export interface LinkCadastro {
  id: string;
  unidadeId?: string;
  unidade?: string;
  pede: PedidoLink[];
  expiraEm: string;
  criadoEm: string;
  criadoPor?: string;
  encerradoEm?: string;
  ativo: boolean;
  envios: number;
  aConferir: number;
  versao: number;
  codigo?: string;
}

export interface LinksCadastro {
  itens: LinkCadastro[];
  unidade?: string;
  podeCriar: boolean;
}

/** O que chegou pelo link, como a pessoa mandou. */
export interface CadastroLink {
  id: string;
  linkId: string;
  unidadeId: string;
  unidade: string;
  nome: string;
  telefone: string;
  ligacao?: LigacaoCadastro;
  email?: string;
  aniversario?: Aniversario;
  familia: FamiliarCadastro[];
  pets: PetCadastro[];
  veiculos: VeiculoCadastro[];
  estado: "ENVIADO" | "APROVADO" | "RECUSADO";
  enviadoEm: string;
  corrigidoEm?: string;
  motivo?: MotivoRecusaCadastro;
  explicacao?: string;
  versao: number;
  linkAtivo: boolean;
  linkExpiraEm: string;
}

export interface FilaCadastros {
  itens: CadastroLink[];
  podeConfirmar: boolean;
}

/** A página do link, sem conta. envio: o que esta pessoa mandou, pela chave guardada no aparelho. */
export interface CadastroPublico {
  condominio: string;
  unidadeId?: string;
  unidade?: string;
  unidades?: { id: string; nome: string }[];
  pede: PedidoLink[];
  expiraEm: string;
  aberto: boolean;
  envio?: Omit<CadastroLink, "id" | "linkId" | "versao" | "linkAtivo" | "linkExpiraEm" | "corrigidoEm">;
  chave?: string;
}

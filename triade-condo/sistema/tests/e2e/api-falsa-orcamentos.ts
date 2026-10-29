// Orçamentos e compras (R8, OC-01 a OC-07 e OC-10; quadros 470 a 486) na API falsa da Plataforma,
// no contrato da API real (docs/orcamentos-r8/contrato-api.md; banco na 0317, rotas em
// supabase/functions/api-plataforma/orcamentos.ts). As regras de verdade ficam no banco (pgTAP 065) e
// na API (Deno); aqui só o bastante para a tela. Os dados de exemplo são os dos quadros: a troca da
// bomba de recalque 2 com HidroPress, Bombas Brasília e Águia Hidráulica.
import { randomBytes } from "node:crypto";
import type { Route } from "@playwright/test";
import { caminhoLinkOrcamento, mensagemConvite } from "../../packages/domain/src/orcamentos.ts";
import { AGORA } from "./api-falsa-pedidos";

const PLATAFORMA = "http://localhost:3000";
const HORA = 3600_000;
const DIA = 24 * HORA;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();
const diaDe = (iso: string) => new Date(Date.parse(iso) - 3 * HORA).toISOString().slice(0, 10);
const HOJE = diaDe(AGORA);
const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
let n = 0;
const novoId = () => `5c6d7e8f-9a0b-4c1d-8e2f-${String(++n).padStart(12, "0")}`;
/** O código do link: 43 caracteres, como o da API (32 bytes em base64url). */
const novoCodigo = () => randomBytes(32).toString("base64url");
/** Os códigos das sementes: legíveis no teste, com os 43 caracteres do código de verdade. */
const semente = (nome: string) => `${nome}-${"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH"}`.slice(0, 43);
/** "02/11, 18h" ou "02/11, 18h01", no horário de Brasília (prazo_texto da 0317). */
function prazoTexto(iso: string) {
  const d = new Date(Date.parse(iso) - 3 * HORA);
  const p2 = (x: number) => String(x).padStart(2, "0");
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}, ${p2(d.getUTCHours())}h${d.getUTCMinutes() ? p2(d.getUTCMinutes()) : ""}`;
}

const ESTADOS: Record<string, string> = {
  RASCUNHO: "Rascunho", PEDINDO: "Pedindo propostas", COMPARANDO: "Pronto para comparar", ESCOLHIDA: "Escolhida", COMPRANDO: "Comprando", ENTREGUE: "Entregue", CANCELADO: "Cancelado",
};
const DIAS_SEM_ACEITE = 5;

export interface PropostaFalsa {
  id: string; numero: number; valor: number; frete: number; freteIncluso: boolean; marcaModelo: string | null; prazoExecucao: string; garantia: string | null;
  validaAte: string; pagamento: string | null; inclui: string; naoInclui: string | null; pdfId: string | null; enviadaEm: string; confirmadaEm: string | null;
  confirmacaoPedidaEm: string | null; emUso: boolean;
  /** O que não inclui é algo que foi pedido (quadro 479: "Falta algo pedido"). */
  faltaAlgo?: boolean;
}
export interface ConviteFalso {
  id: string; prestadorId: string | null; nome: string; celular: string | null; email: string | null; canal: "WHATSAPP" | "EMAIL";
  estado: "CONVIDADO" | "RECUSOU" | "RESPONDEU" | "REVOGADO"; recusaMotivo: string | null; recusouEm: string | null; aberturas: number; ultimaAberturaEm: string | null;
  codigo: string; codigosAntigos: string[]; expiraEm: string; mandadoEm: string | null; revogado: { em: string; motivo: string } | null; escolhido: boolean;
  aceiteEm: string | null; aceiteNome: string | null; aceiteForaDoLink: boolean; resultadoAvisadoEm: string | null; versao: number; propostas: PropostaFalsa[];
}
export interface ArquivoFalso { id: string; parte: "PEDIDO" | "NOTA_FISCAL" | "PROPOSTA"; nome: string; tipo: string; tamanho: number; situacao: "ENVIANDO" | "LIBERADO"; conviteId: string | null; propostaId: string | null }
export interface EventoFalso { em: string; acao: string; quem?: string; texto: string; tom?: string; dados?: Record<string, unknown> }
export interface OrcamentoFalso {
  id: string; titulo: string; descricao: string; local: string | null; tipo: "SERVICO"; manutencaoId: string | null; manutencaoTitulo: string | null;
  pedidoId: string | null; pedidoTexto: string | null; origemPreventiva: string | null; valorEstimado: number | null; prazoPropostas: string; validadeMinimaDias: number;
  cuidador: { id: string; nome: string; cargo: string }; criadoEm: string; editadoEm: string | null; estado: string; fechadoEm: string | null;
  /** Alguém que edita já abriu a ficha ou a comparação depois de o prazo fechar (tira o PRAZO_FECHOU). */
  fechamentoVisto: boolean;
  escolha: { propostaId: string; conviteId: string; motivo: string | null; em: string; por: string; quemAprova: "PESSOA" | "CONSELHO"; despesaId: string | null; despesaEstado: string | null; aprovadaEm: string | null } | null;
  recusa: { em: string; estado: string; despesaId: string; justificativa: string | null } | null;
  compra: { compradaEm: string; valorFechado: number; notaFiscalId: string | null } | null;
  entrega: { entregueEm: string; parcial: boolean; observacao: string | null } | null;
  cancelado: { em: string; motivo: string; por: string } | null;
  versao: number; convites: ConviteFalso[]; arquivos: ArquivoFalso[]; historico: EventoFalso[];
}
export interface RegrasFalsas { versao: number; ligada: boolean; faixas: { ate: number | null; minimo: number; quemAprova: "SINDICO" | "CONSELHO" }[]; abaixoMinimo: "MOTIVO" | "BLOQUEIA"; prazoDias: number; validadeDias: number; linkDias: number }

export interface EstadoOrcamentos {
  orcamentos: OrcamentoFalso[];
  regras: RegrasFalsas;
  prestadores: { id: string; nome: string; servico: string; canal: "WHATSAPP" | "EMAIL"; celular: string | null; email: string | null; servicosFeitos: number }[];
  enviados: { caminho: string; corpo: Record<string, unknown> }[];
  /** A alçada que o PUT das regras mandou (é a mesma de Decisões). */
  alcadaGravada?: number | null;
}

export function criarOrcamentos(): EstadoOrcamentos {
  return {
    orcamentos: [], enviados: [],
    regras: { versao: 1, ligada: true, faixas: [{ ate: 100000, minimo: 1, quemAprova: "SINDICO" }, { ate: 300000, minimo: 2, quemAprova: "SINDICO" }, { ate: null, minimo: 3, quemAprova: "CONSELHO" }],
      abaixoMinimo: "MOTIVO", prazoDias: 7, validadeDias: 15, linkDias: 30 },
    prestadores: [
      { id: "aa10b2c3-0000-4000-8000-000000000001", nome: "HidroPress Bombas", servico: "Bombas e hidráulica", canal: "WHATSAPP", celular: "61981230001", email: null, servicosFeitos: 4 },
      { id: "aa10b2c3-0000-4000-8000-000000000002", nome: "Bombas Brasília", servico: "Bombas e hidráulica", canal: "EMAIL", celular: null, email: "contato@bombasbrasilia.com.br", servicosFeitos: 1 },
      { id: "aa10b2c3-0000-4000-8000-000000000003", nome: "Elétrica Central", servico: "Elétrica", canal: "WHATSAPP", celular: "61981230003", email: null, servicosFeitos: 2 },
      { id: "aa10b2c3-0000-4000-8000-000000000004", nome: "Fogo Zero", servico: "Extintores", canal: "WHATSAPP", celular: "61981230004", email: null, servicosFeitos: 3 },
    ],
  };
}

const ANA = { id: "b1000000-0000-4000-8000-0000000000a1", nome: "Ana Souza", cargo: "Síndica" };
const proposta = (p: Partial<PropostaFalsa> & { numero: number; valor: number; validaAte: string; enviadaEm: string; inclui: string; prazoExecucao: string }): PropostaFalsa => ({
  id: novoId(), frete: 0, freteIncluso: true, marcaModelo: null, garantia: null, pagamento: null, naoInclui: null, pdfId: null, confirmadaEm: null, confirmacaoPedidaEm: null, emUso: true, ...p,
});
const convite = (c: Partial<ConviteFalso> & { nome: string; codigo: string; expiraEm: string }): ConviteFalso => ({
  id: novoId(), prestadorId: null, celular: null, email: null, canal: "WHATSAPP", estado: "CONVIDADO", recusaMotivo: null, recusouEm: null, aberturas: 0, ultimaAberturaEm: null, codigosAntigos: [],
  mandadoEm: null, revogado: null, escolhido: false, aceiteEm: null, aceiteNome: null, aceiteForaDoLink: false, resultadoAvisadoEm: null, versao: 1, propostas: [], ...c,
});
const orcamento = (o: Partial<OrcamentoFalso> & { titulo: string; descricao: string; prazoPropostas: string; criadoEm: string }): OrcamentoFalso => ({
  id: novoId(), local: null, tipo: "SERVICO", manutencaoId: null, manutencaoTitulo: null, pedidoId: null, pedidoTexto: null, origemPreventiva: null, valorEstimado: null,
  validadeMinimaDias: 15, cuidador: ANA, editadoEm: null, estado: "PEDINDO", fechadoEm: null, fechamentoVisto: false, escolha: null, recusa: null, compra: null, entrega: null, cancelado: null, versao: 1,
  convites: [], arquivos: [], historico: [], ...o,
});
const ev = (em: string, acao: string, texto: string, tom?: string, quem?: string): EventoFalso => ({ em, acao, texto, ...(tom ? { tom } : {}), ...(quem ? { quem } : {}) });

/** Os quadros 470 a 486: a bomba com 3 propostas (uma vencida) e uma recusa, a pintura sem propostas,
 * os extintores escolhidos sem aceite há 6 dias e a caixa d'água entregue. */
export function semearOrcamentos(e: EstadoOrcamentos, manutencao?: { id: string; titulo: string }) {
  const [hidro, brasilia, , fogo] = e.prestadores;
  const prazoBomba = depois(-48);
  const mandado = depois(-8 * 24);
  const bomba = orcamento({
    titulo: "Troca da bomba de recalque 2", local: "Casa de bombas · Bomba 2",
    descricao: "Bomba centrífuga equivalente à atual (3 cv, trifásica), instalação, retirada da bomba velha e teste com a caixa cheia. Informar marca e modelo.",
    manutencaoId: manutencao?.id ?? null, manutencaoTitulo: manutencao?.titulo ?? "Bomba de recalque com ruído", valorEstimado: 650000,
    prazoPropostas: prazoBomba, criadoEm: mandado, fechadoEm: prazoBomba, estado: "COMPARANDO",
    convites: [
      convite({ prestadorId: hidro!.id, nome: hidro!.nome, celular: hidro!.celular, canal: "WHATSAPP", codigo: semente("hidropress"), expiraEm: prazoBomba, mandadoEm: mandado, estado: "RESPONDEU", aberturas: 3, ultimaAberturaEm: depois(-5 * 24),
        propostas: [proposta({ numero: 1, valor: 648000, marcaModelo: "KSB Hydrobloc C 3 cv", prazoExecucao: "5 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 25),
          pagamento: "2 vezes (entrada e entrega)", inclui: "Bomba e instalação\nRetirada da velha\nTeste com a caixa cheia", naoInclui: "Quadro elétrico", enviadaEm: depois(-5 * 24) })] }),
      convite({ prestadorId: brasilia!.id, nome: brasilia!.nome, email: brasilia!.email, canal: "EMAIL", codigo: semente("brasilia"), expiraEm: prazoBomba, mandadoEm: mandado, estado: "RESPONDEU", aberturas: 5, ultimaAberturaEm: depois(-3 * 24),
        propostas: [
          proposta({ numero: 1, valor: 642000, marcaModelo: "Dancor CAM-W 3 cv", prazoExecucao: "10 dias úteis", garantia: "6 meses", validaAte: somarDias(HOJE, 20), pagamento: "30 dias depois",
            inclui: "Bomba e instalação\nTeste com a caixa cheia", naoInclui: "Retirada da velha: R$ 250,00 à parte", faltaAlgo: true, enviadaEm: depois(-7 * 24), emUso: false }),
          proposta({ numero: 2, valor: 595000, frete: 18000, freteIncluso: false, marcaModelo: "Dancor CAM-W 3 cv", prazoExecucao: "10 dias úteis", garantia: "6 meses", validaAte: somarDias(HOJE, -1),
            pagamento: "30 dias depois", inclui: "Bomba e instalação\nTeste com a caixa cheia", naoInclui: "Retirada da velha: R$ 250,00 à parte", faltaAlgo: true, enviadaEm: depois(-3 * 24) }),
        ] }),
      convite({ nome: "Águia Hidráulica", celular: "61981234567", canal: "WHATSAPP", codigo: semente("aguia"), expiraEm: prazoBomba, mandadoEm: mandado, estado: "RESPONDEU", aberturas: 2, ultimaAberturaEm: depois(-4 * 24),
        propostas: [proposta({ numero: 1, valor: 720000, marcaModelo: "Schneider BC-92 S 3 cv", prazoExecucao: "3 dias úteis", garantia: "24 meses", validaAte: somarDias(HOJE, 30),
          pagamento: "À vista, na entrega", inclui: "Bomba e instalação\nRetirada da velha\nRevisão do quadro elétrico\nTeste", naoInclui: "Tubulação corroída", enviadaEm: depois(-4 * 24) })] }),
      convite({ nome: "Central das Bombas", celular: "61981230099", canal: "WHATSAPP", codigo: semente("central"), expiraEm: prazoBomba, mandadoEm: mandado, estado: "RECUSOU", recusaMotivo: "Não atendemos Águas Claras",
        recusouEm: depois(-7 * 24), aberturas: 1 }),
    ],
    historico: [
      ev(prazoBomba, "orcamento.prazo_fechou", "Prazo fechou com 3 propostas", "violeta"),
      ev(depois(-3 * 24), "orcamento.proposta", "Bombas Brasília mandou a versão 2 (de R$ 6.420,00 para R$ 6.130,00). A versão 1 fica guardada.", "violeta"),
      ev(depois(-7 * 24), "orcamento.recusou", "Central das Bombas recusou o convite", "neutro"),
      ev(mandado, "orcamento.criado", "Ana criou o orçamento e mandou 4 convites", "violeta", "Ana Souza"),
    ],
  });
  bomba.arquivos.push({ id: novoId(), parte: "PEDIDO", nome: "Bomba 2 com vazamento.jpg", tipo: "image/jpeg", tamanho: 1_200_000, situacao: "LIBERADO", conviteId: null, propostaId: null },
    { id: novoId(), parte: "PEDIDO", nome: "Placa da bomba.jpg", tipo: "image/jpeg", tamanho: 800_000, situacao: "LIBERADO", conviteId: null, propostaId: null });
  const aguia = bomba.convites[2]!;
  bomba.arquivos.push({ id: novoId(), parte: "PROPOSTA", nome: "Proposta 0412 Águia Hidráulica.pdf", tipo: "application/pdf", tamanho: 90_000, situacao: "LIBERADO", conviteId: aguia.id, propostaId: aguia.propostas[0]!.id });
  aguia.propostas[0]!.pdfId = bomba.arquivos[2]!.id;

  const prazoPintura = depois(21 * 24);
  const pintou = depois(-2 * 24);
  const pintura = orcamento({
    titulo: "Pintura do hall da Torre A", local: "Hall da Torre A", descricao: "Pintura das paredes e do teto do hall, com massa corrida onde precisar. Tinta lavável.",
    prazoPropostas: prazoPintura, criadoEm: pintou, valorEstimado: 1200000,
    convites: [
      convite({ nome: "Pinturas Lima", celular: "61981230011", codigo: semente("lima"), expiraEm: prazoPintura, mandadoEm: pintou, aberturas: 1, ultimaAberturaEm: depois(-24) }),
      convite({ nome: "Cor e Arte", celular: "61981230012", codigo: semente("cor"), expiraEm: prazoPintura, mandadoEm: pintou }),
      convite({ nome: "JB Pinturas", email: "jb@pinturas.com.br", canal: "EMAIL", codigo: semente("jb"), expiraEm: prazoPintura, mandadoEm: pintou }),
      convite({ nome: "Tintas do Lago", celular: "61981230014", codigo: semente("lago"), expiraEm: prazoPintura, mandadoEm: pintou, estado: "RECUSOU", recusaMotivo: null, recusouEm: depois(-24) }),
    ],
    historico: [ev(depois(-24), "orcamento.recusou", "Tintas do Lago recusou o convite", "neutro"), ev(pintou, "orcamento.criado", "Ana criou o orçamento e mandou 4 convites", "violeta", "Ana Souza")],
  });

  const prazoExt = depois(-9 * 24);
  const fogoZero = convite({ prestadorId: fogo!.id, nome: fogo!.nome, celular: fogo!.celular, codigo: semente("fogo"), expiraEm: prazoExt, mandadoEm: depois(-12 * 24), estado: "RESPONDEU", aberturas: 2, escolhido: true,
    propostas: [proposta({ numero: 1, valor: 98000, prazoExecucao: "2 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 10), inclui: "Recarga dos 12 extintores e troca dos lacres", enviadaEm: depois(-10 * 24) })] });
  const outra = convite({ nome: "Extintores Planalto", celular: "61981230021", codigo: semente("planalto"), expiraEm: prazoExt, mandadoEm: depois(-12 * 24), estado: "RESPONDEU", aberturas: 1, resultadoAvisadoEm: depois(-6 * 24),
    propostas: [proposta({ numero: 1, valor: 115000, prazoExecucao: "3 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 12), inclui: "Recarga dos 12 extintores", enviadaEm: depois(-10 * 24) })] });
  const extintores = orcamento({
    titulo: "Recarga dos extintores", local: "Todos os andares", descricao: "Recarga dos 12 extintores do prédio, com os lacres e o laudo.", origemPreventiva: "Preventiva · Extintores",
    prazoPropostas: prazoExt, criadoEm: depois(-12 * 24), fechadoEm: prazoExt, fechamentoVisto: true, estado: "ESCOLHIDA", valorEstimado: 100000,
    escolha: { propostaId: fogoZero.propostas[0]!.id, conviteId: fogoZero.id, motivo: null, em: depois(-6 * 24), por: "Ana Souza", quemAprova: "PESSOA", despesaId: null, despesaEstado: null, aprovadaEm: depois(-6 * 24) },
    convites: [fogoZero, outra],
    historico: [ev(depois(-6 * 24), "orcamento.escolhida", "Proposta de Fogo Zero escolhida", "ok", "Ana Souza"), ev(prazoExt, "orcamento.prazo_fechou", "Prazo fechou com 2 propostas", "violeta")],
  });

  const prazoCaixa = depois(-20 * 24);
  const hidroServ = convite({ nome: "Hidro Serviços", celular: "61981230031", codigo: semente("hidroserv"), expiraEm: prazoCaixa, mandadoEm: depois(-25 * 24), estado: "RESPONDEU", aberturas: 2, escolhido: true, aceiteEm: depois(-15 * 24), aceiteNome: "Carlos Hidro",
    propostas: [proposta({ numero: 1, valor: 180000, prazoExecucao: "1 dia", garantia: "Laudo de potabilidade", validaAte: somarDias(HOJE, 5), inclui: "Limpeza das duas caixas e laudo", enviadaEm: depois(-22 * 24) })] });
  const caixa = orcamento({
    titulo: "Limpeza da caixa d’água", local: "Cobertura", descricao: "Limpeza semestral das duas caixas d’água, com laudo.", origemPreventiva: "Preventiva · Caixa d’água",
    prazoPropostas: prazoCaixa, criadoEm: depois(-25 * 24), fechadoEm: prazoCaixa, fechamentoVisto: true, estado: "ENTREGUE", valorEstimado: 200000,
    escolha: { propostaId: hidroServ.propostas[0]!.id, conviteId: hidroServ.id, motivo: null, em: depois(-16 * 24), por: "Ana Souza", quemAprova: "PESSOA", despesaId: null, despesaEstado: null, aprovadaEm: depois(-16 * 24) },
    compra: { compradaEm: somarDias(HOJE, -14), valorFechado: 180000, notaFiscalId: null }, entrega: { entregueEm: somarDias(HOJE, -4), parcial: false, observacao: null },
    convites: [hidroServ, convite({ nome: "Limpa Tudo", celular: "61981230032", codigo: semente("limpa"), expiraEm: prazoCaixa, mandadoEm: depois(-25 * 24), estado: "RESPONDEU", aberturas: 1, resultadoAvisadoEm: depois(-16 * 24),
      propostas: [proposta({ numero: 1, valor: 210000, prazoExecucao: "1 dia", validaAte: somarDias(HOJE, 3), inclui: "Limpeza das duas caixas", enviadaEm: depois(-22 * 24) })] })],
    historico: [ev(depois(-4 * 24), "orcamento.entrega", "Entrega registrada", "ok", "Ana Souza"), ev(depois(-14 * 24), "orcamento.compra", "Compra registrada", "ok", "Ana Souza"),
      ev(depois(-15 * 24), "orcamento.aceite", "Hidro Serviços aceitou fazer o serviço", "ok")],
  });
  e.orcamentos.push(bomba, pintura, extintores, caixa);
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}
const motivo = (route: Route, m: string) => erro(route, 400, "VALIDATION_ERROR", { motivo: m });
const campos = (route: Route, ...c: string[]) => erro(route, 400, "VALIDATION_ERROR", { campos: c });
const conflito = (route: Route, o: { versao: number }) => erro(route, 409, "VERSION_CONFLICT", { versao: o.versao, atual: o });

const emUso = (c: ConviteFalso) => c.propostas.find((p) => p.emUso) ?? null;
const total = (p: PropostaFalsa) => p.valor + (p.freteIncluso ? 0 : p.frete);
const vencida = (p: PropostaFalsa) => p.validaAte < HOJE && !p.confirmadaEm;
const letra = (i: number) => String.fromCharCode(65 + i);
const prazoFechou = (o: OrcamentoFalso) => o.estado !== "RASCUNHO" && (!!o.fechadoEm || o.prazoPropostas <= AGORA);
const validos = (o: OrcamentoFalso) => o.convites.filter((c) => c.estado !== "REVOGADO");
const recebidas = (o: OrcamentoFalso) => validos(o).filter((c) => emUso(c)).length;
const convidados = (o: OrcamentoFalso) => validos(o).length;
const mascarar = (c: ConviteFalso) => c.canal === "WHATSAPP" ? (c.celular ? `(${c.celular.slice(0, 2)}) ••••-${c.celular.slice(-4)}` : null) : (c.email ? `${c.email.slice(0, 2)}•••@${c.email.split("@")[1]}` : null);
const ABERTO = ["RASCUNHO", "PEDINDO", "COMPARANDO", "ESCOLHIDA", "COMPRANDO"];

export interface ContextoOrcamentos {
  eu: { vinculo: string; nome: string };
  /** O cargo de quem está na sessão: vai na mensagem pronta do convite ("Ana Souza, Síndica do ..."). */
  cargo?: string;
  pode: (a: string) => boolean;
  sindico: boolean;
  alcada: () => number | null;
  /** O PUT das regras grava a alçada de Decisões (é um número só). */
  gravarAlcada?: (v: number | null) => void;
  conselho: () => { podePedir: boolean; titulares: number };
  manutencoes: () => { id: string; titulo: string; local: string | null }[];
  pedidos: () => { id: string; numero: string; titulo: string }[];
  /** Cria a despesa para aprovar no conselho e devolve o id. */
  criarDespesa: (o: OrcamentoFalso, valor: number, fornecedor: string) => string;
  despesaEstado: (id: string) => string | null;
}
const quemSou = (x: ContextoOrcamentos) => ({ id: x.eu.vinculo, nome: x.eu.nome, cargo: x.cargo ?? (x.sindico ? "Síndica" : "Gestão") });

/** O prazo fecha na leitura (PEDINDO → COMPARANDO), e a escolha anda com a resposta do conselho. */
function conferir(o: OrcamentoFalso, x?: ContextoOrcamentos) {
  if (o.estado === "PEDINDO" && o.prazoPropostas <= AGORA) {
    o.estado = "COMPARANDO"; o.fechadoEm = o.prazoPropostas; o.fechamentoVisto = false; o.versao++;
    o.historico.unshift(ev(o.prazoPropostas, "orcamento.prazo_fechou", `Prazo fechou com ${recebidas(o) === 1 ? "1 proposta" : `${recebidas(o)} propostas`}`, "violeta"));
  }
  if (x && o.estado === "ESCOLHIDA" && o.escolha?.despesaId) {
    const estado = x.despesaEstado(o.escolha.despesaId) ?? o.escolha.despesaEstado;
    o.escolha.despesaEstado = estado;
    if (estado === "APROVADA" && !o.escolha.aprovadaEm) {
      o.escolha.aprovadaEm = AGORA;
      o.historico.unshift(ev(AGORA, "orcamento.aprovada", "Aprovada", "ok"));
      if (o.convites.find((c) => c.id === o.escolha!.conviteId)?.aceiteEm) o.estado = "COMPRANDO";
    }
    if (estado === "RECUSADA" || estado === "RETIRADA") {
      o.recusa = { em: AGORA, estado: estado!, despesaId: o.escolha.despesaId, justificativa: estado === "RECUSADA" ? "Recusada pelo conselho" : null };
      for (const c of o.convites) c.escolhido = false;
      o.escolha = null; o.estado = "COMPARANDO"; o.versao++;
      o.historico.unshift(ev(AGORA, "orcamento.recusada", "O conselho recusou a escolha", "erro"));
    }
  }
}

function faixaDoValor(e: EstadoOrcamentos, valor: number | null) {
  if (!e.regras.ligada || valor === null) return null;
  for (const f of e.regras.faixas) if (f.ate === null || valor <= f.ate) return f;
  return null;
}
/** orcamento.regra: { ligada, faixa (sem `ate` na última), minimo, recebidas, anterior, passaAlcada, abaixoMinimo, alcadaConselho, minimoAtendido }. */
function regraDe(e: EstadoOrcamentos, o: OrcamentoFalso, alcada: number | null) {
  const menor = validos(o).map(emUso).filter((p): p is PropostaFalsa => !!p).map(total).sort((a, b) => a - b)[0] ?? null;
  const faixa = faixaDoValor(e, o.valorEstimado ?? menor);
  const i = faixa ? e.regras.faixas.indexOf(faixa) : -1;
  const escolhida = o.escolha ? o.convites.flatMap((c) => c.propostas).find((p) => p.id === o.escolha!.propostaId) ?? null : null;
  const minimo = faixa?.minimo ?? 1;
  return {
    ligada: e.regras.ligada,
    ...(faixa ? { faixa: { minimo: faixa.minimo, quemAprova: faixa.quemAprova, ...(faixa.ate === null ? {} : { ate: faixa.ate }) } } : {}),
    minimo, recebidas: recebidas(o), ...(i > 0 ? { anterior: e.regras.faixas[i - 1]!.ate } : {}),
    passaAlcada: alcada !== null && ((escolhida ? total(escolhida) : menor ?? 0) > alcada),
    abaixoMinimo: e.regras.abaixoMinimo, alcadaConselho: alcada, minimoAtendido: recebidas(o) >= minimo,
  };
}

function situacao(o: OrcamentoFalso): string {
  if (o.estado === "ESCOLHIDA") {
    if (o.escolha?.despesaEstado === "AGUARDANDO") return "Esperando o conselho";
    const c = o.convites.find((x) => x.id === o.escolha?.conviteId);
    return c?.aceiteEm ? "Esperando a aprovação" : "Esperando o aceite do fornecedor";
  }
  return ESTADOS[o.estado]!;
}
function semAceiteDias(o: OrcamentoFalso): number | null {
  if (o.estado !== "ESCOLHIDA" || !o.escolha) return null;
  const c = o.convites.find((x) => x.id === o.escolha!.conviteId);
  if (!c || c.aceiteEm) return null;
  return Math.floor((Date.parse(AGORA) - Date.parse(o.escolha.em)) / DIA);
}
const vencidas = (o: OrcamentoFalso) => validos(o).map(emUso).filter((p): p is PropostaFalsa => !!p && vencida(p)).length;
function pedeAtencao(o: OrcamentoFalso): string[] {
  const avisos: string[] = [];
  if (o.estado === "COMPARANDO" && !o.fechamentoVisto) avisos.push("PRAZO_FECHOU");
  if (vencidas(o) && ["PEDINDO", "COMPARANDO"].includes(o.estado)) avisos.push("PROPOSTA_VENCIDA");
  const d = semAceiteDias(o);
  if (d !== null && d >= DIAS_SEM_ACEITE) avisos.push("SEM_ACEITE");
  return avisos;
}
function origem(o: OrcamentoFalso) {
  if (o.manutencaoId || o.manutencaoTitulo) return { tipo: "MANUTENCAO", id: o.manutencaoId, texto: `Manutenção · ${o.manutencaoTitulo}` };
  if (o.pedidoId) return { tipo: "PEDIDO", id: o.pedidoId, texto: `Pedido · ${o.pedidoTexto}` };
  if (o.origemPreventiva) return { tipo: "PREVENTIVA", id: null, texto: o.origemPreventiva };
  return null;
}

/** O resumo do Início e do menu (painel.orcamentos). `paraDecidir` só conta para quem decide. */
export function resumoOrcamentos(e: EstadoOrcamentos, decide = true) {
  for (const o of e.orcamentos) conferir(o);
  const abertos = e.orcamentos.filter((o) => ABERTO.includes(o.estado));
  return {
    emAndamento: abertos.length,
    paraDecidir: decide ? abertos.filter((o) => o.estado === "COMPARANDO" && o.fechamentoVisto && recebidas(o) > 0).length : 0,
    pedeAtencao: abertos.filter((o) => pedeAtencao(o).length).length,
  };
}

function resumoJson(o: OrcamentoFalso) {
  const esc = o.escolha ? o.convites.find((c) => c.id === o.escolha!.conviteId) : null;
  const pEsc = esc && o.escolha ? esc.propostas.find((p) => p.id === o.escolha!.propostaId) : null;
  return {
    id: o.id, titulo: o.titulo, tipo: o.tipo, local: o.local, estado: o.estado, situacao: situacao(o), origem: origem(o),
    convidados: convidados(o), recebidas: recebidas(o), recusas: o.convites.filter((c) => c.estado === "RECUSOU").length,
    prazoPropostas: o.prazoPropostas, prazoFechou: prazoFechou(o), vencidas: vencidas(o),
    ...(esc && pEsc ? { escolhida: { nome: esc.nome, total: total(pEsc) } } : {}),
    ...(o.escolha ? { decididoEm: o.escolha.em } : {}),
    ...(o.estado === "ENTREGUE" && o.entrega ? { concluidoEm: o.entrega.entregueEm } : {}),
    ...(o.cancelado ? { canceladoEm: o.cancelado.em } : {}),
    pedeAtencao: pedeAtencao(o), versao: o.versao,
  };
}

const propostaJson = (o: OrcamentoFalso, p: PropostaFalsa) => {
  const pdf = p.pdfId ? o.arquivos.find((a) => a.id === p.pdfId && a.situacao === "LIBERADO") : null;
  return { id: p.id, numero: p.numero, total: total(p), valor: p.valor, frete: p.frete, freteIncluso: p.freteIncluso, marcaModelo: p.marcaModelo, prazoExecucao: p.prazoExecucao,
    garantia: p.garantia, validaAte: p.validaAte, vencida: vencida(p), confirmada: !!p.confirmadaEm, confirmadaEm: p.confirmadaEm, confirmacaoPedidaEm: p.confirmacaoPedidaEm,
    pagamento: p.pagamento, inclui: p.inclui, naoInclui: p.naoInclui, faltaAlgo: !!p.faltaAlgo, pdf: pdf ? { id: pdf.id, nome: pdf.nome } : null, enviadaEm: p.enviadaEm };
};

function detalheJson(e: EstadoOrcamentos, x: ContextoOrcamentos, o: OrcamentoFalso) {
  const edita = x.pode("orcamentos.editar");
  const decide = x.pode("orcamentos.decidir");
  const esc = o.escolha ? o.convites.find((c) => c.id === o.escolha!.conviteId) ?? null : null;
  const propEsc = o.escolha ? o.convites.flatMap((c) => c.propostas).find((p) => p.id === o.escolha!.propostaId) ?? null : null;
  const dias = semAceiteDias(o);
  return {
    hoje: HOJE,
    orcamento: {
      ...resumoJson(o), descricao: o.descricao, valorEstimado: o.valorEstimado, validadeMinimaDias: o.validadeMinimaDias, cuidador: { id: o.cuidador.id, nome: o.cuidador.nome },
      criadoEm: o.criadoEm, criadoPor: o.cuidador.nome, editadoEm: o.editadoEm, regra: regraDe(e, o, x.alcada()),
      escolha: o.escolha && esc && propEsc ? {
        propostaId: o.escolha.propostaId, convite: { id: esc.id, nome: esc.nome, letra: letra(o.convites.indexOf(esc)) }, total: total(propEsc),
        motivo: o.escolha.motivo, quemAprova: o.escolha.quemAprova, escolhidaEm: o.escolha.em, escolhidaPor: o.escolha.por, despesaId: o.escolha.despesaId,
        despesaEstado: o.escolha.despesaEstado, aprovadaEm: o.escolha.aprovadaEm,
        ...(o.escolha.quemAprova === "CONSELHO" && o.escolha.aprovadaEm ? { despesaJustificativa: "Aprovada por 3 de 4 titulares" } : {}),
        ...(esc.aceiteEm ? { aceiteEm: esc.aceiteEm, aceiteNome: esc.aceiteNome } : {}), aceiteForaDoLink: esc.aceiteForaDoLink,
        ...(dias !== null ? { semAceiteHaDias: dias } : {}),
      } : null,
      ...(o.recusa ? { recusa: o.recusa } : {}),
      compra: o.compra ? { compradaEm: o.compra.compradaEm, valorFechado: o.compra.valorFechado,
        notaFiscal: o.compra.notaFiscalId ? { id: o.compra.notaFiscalId, nome: o.arquivos.find((a) => a.id === o.compra!.notaFiscalId)?.nome ?? "Nota fiscal" } : null } : null,
      entrega: o.entrega, cancelado: o.cancelado,
    },
    convites: o.convites.map((c, i) => {
      const p = emUso(c);
      return { id: c.id, letra: letra(i), nome: c.nome, origem: c.prestadorId ? "PRESTADOR" : "LINK", prestadorId: c.prestadorId, canal: c.canal, contatoMascarado: mascarar(c),
        ...(c.mandadoEm ? { envio: c.canal === "EMAIL" ? "ENVIADO" : "COPIAR", mandadoEm: c.mandadoEm } : {}), ...(c.ultimaAberturaEm ? { ultimaAberturaEm: c.ultimaAberturaEm } : {}),
        estado: c.estado, aberturas: c.aberturas, recusaMotivo: c.recusaMotivo, recusouEm: c.recusouEm, propostaEmUso: p ? propostaJson(o, p) : null, versoes: c.propostas.length,
        revogado: c.revogado, escolhido: c.escolhido, aceiteForaDoLink: c.aceiteForaDoLink, versao: c.versao };
    }),
    arquivos: o.arquivos.filter((a) => a.parte !== "PROPOSTA" && a.situacao === "LIBERADO").map((a) => ({ id: a.id, parte: a.parte, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, situacao: a.situacao })),
    historico: o.historico,
    pode: {
      editar: edita && ["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado), convidar: edita && ["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado),
      mandar: edita && o.estado === "RASCUNHO" && convidados(o) > 0,
      estender: edita && ["PEDINDO", "COMPARANDO"].includes(o.estado), fechar: edita && o.estado === "PEDINDO" && o.prazoPropostas > AGORA,
      comparar: ["PEDINDO", "COMPARANDO", "ESCOLHIDA", "COMPRANDO", "ENTREGUE"].includes(o.estado) && recebidas(o) > 0, decidir: decide && o.estado === "COMPARANDO" && recebidas(o) > 0,
      desfazerEscolha: decide && o.estado === "ESCOLHIDA" && !esc?.aceiteEm && (!o.escolha?.despesaId || o.escolha.despesaEstado === "AGUARDANDO"),
      aceiteFora: edita && o.estado === "ESCOLHIDA" && !esc?.aceiteEm,
      registrarCompra: edita && o.estado === "COMPRANDO" && !o.compra, registrarEntrega: edita && o.estado === "COMPRANDO" && !!o.compra,
      anexar: edita && ["RASCUNHO", "PEDINDO", "COMPARANDO", "COMPRANDO"].includes(o.estado),
      cancelar: edita && ABERTO.includes(o.estado),
    },
  };
}

function comparacaoJson(e: EstadoOrcamentos, x: ContextoOrcamentos, o: OrcamentoFalso) {
  const lista = o.convites.map((c, i) => ({ c, i, p: emUso(c) })).filter((y): y is { c: ConviteFalso; i: number; p: PropostaFalsa } => !!y.p && y.c.estado !== "REVOGADO");
  const menor = [...lista].sort((a, b) => total(a.p) - total(b.p))[0];
  const propostas = lista.map(({ c, i, p }) => ({
    ...propostaJson(o, p), conviteId: c.id, letra: letra(i), nome: c.nome, origem: c.prestadorId ? "PRESTADOR" : "LINK", ...(c.prestadorId ? { prestadorId: c.prestadorId } : {}),
    conviteEstado: c.estado, versoes: c.propostas.length, menorTotal: c === menor?.c,
    anteriores: c.propostas.filter((q) => !q.emUso).reverse().map((q) => ({ id: q.id, numero: q.numero, total: total(q), validaAte: q.validaAte, enviadaEm: q.enviadaEm })),
  }));
  const r = regraDe(e, o, x.alcada());
  return {
    hoje: HOJE,
    pode: { decidir: x.pode("orcamentos.decidir") && o.estado === "COMPARANDO" && propostas.length > 0, pedirConfirmacao: x.pode("orcamentos.editar") && ["PEDINDO", "COMPARANDO"].includes(o.estado) },
    regra: r, minimo: { pedido: r.minimo, atendido: r.minimoAtendido, recebidas: propostas.length, abaixoMinimo: e.regras.abaixoMinimo },
    conselho: x.conselho(),
    orcamento: { id: o.id, local: o.local, estado: o.estado, titulo: o.titulo, versao: o.versao, descricao: o.descricao, motivoEscolha: o.escolha?.motivo ?? null,
      valorEstimado: o.valorEstimado, propostaEscolhidaId: o.escolha?.propostaId ?? null },
    propostas, menorTotal: menor?.c.id ?? null, alcadaConselho: x.alcada(),
  };
}

/** O link de cada convite (quadro 475): pelo WhatsApp volta COPIAR, com o `link` e o `texto` prontos. */
function linkDe(x: ContextoOrcamentos, o: OrcamentoFalso, c: ConviteFalso) {
  const eu = quemSou(x);
  const mensagem = { quem: eu.nome, cargo: eu.cargo, prazo: prazoTexto(o.prazoPropostas), titulo: o.titulo, condominio: "Residencial Ipê" };
  const base = { nome: c.nome, canal: c.canal, letra: letra(o.convites.indexOf(c)), mensagem, conviteId: c.id };
  if (c.canal === "EMAIL") return { ...base, envio: "EMAIL" };
  const link = `${PLATAFORMA}${caminhoLinkOrcamento(c.codigo)}`;
  return { ...base, envio: "COPIAR", codigo: c.codigo, link, texto: mensagemConvite({ ...mensagem, link }) };
}
function mandarConvite(c: ConviteFalso) {
  if (c.mandadoEm) c.codigosAntigos.push(c.codigo);
  c.codigo = novoCodigo(); c.mandadoEm = AGORA; c.versao++;
}

function novoConvite(e: EstadoOrcamentos, o: OrcamentoFalso, d: Record<string, unknown>): ConviteFalso | string {
  const prestador = d.prestadorId ? e.prestadores.find((p) => p.id === d.prestadorId) : null;
  if (d.prestadorId && !prestador) return "prestadorId";
  if (d.canal !== "WHATSAPP" && d.canal !== "EMAIL") return "canal";
  const nome = prestador ? prestador.nome : String(d.nome ?? "").trim();
  if (nome.length < 2) return "nome";
  const canal = d.canal;
  const celular = prestador ? prestador.celular : String(d.celular ?? "").replace(/\D/g, "") || null;
  const email = prestador ? prestador.email : String(d.email ?? "").trim() || null;
  if (canal === "WHATSAPP" && !celular) return "celular";
  if (canal === "EMAIL" && !email) return "email";
  return convite({ prestadorId: prestador?.id ?? null, nome, celular, email, canal, codigo: novoCodigo(), expiraEm: o.prazoPropostas });
}

export async function rotasOrcamentos(route: Route, e: EstadoOrcamentos, x: ContextoOrcamentos, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL): Promise<void | null> {
  if (!caminho.startsWith("/v1/condominio/orcamentos") && caminho !== "/v1/condominio/regras-orcamento") return null;
  const anota = () => e.enviados.push({ caminho: `${metodo} ${caminho}`, corpo });
  const texto = (k: string) => String(corpo[k] ?? "").trim();
  const hist = (o: OrcamentoFalso, acao: string, t: string, tom = "violeta") => o.historico.unshift(ev(AGORA, acao, t, tom, x.eu.nome));
  const primeiro = x.eu.nome.split(" ")[0];

  if (caminho === "/v1/condominio/regras-orcamento") {
    if (!x.pode("config.ver")) return erro(route, 403, "FORBIDDEN");
    if (metodo === "GET") return route.fulfill({ json: { ...e.regras, alcadaConselho: x.alcada(), pode: { editar: x.pode("config.editar") } } });
    if (!x.pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    anota();
    if (corpo.versao !== e.regras.versao) return conflito(route, e.regras);
    const faixas = (corpo.faixas as RegrasFalsas["faixas"]) ?? [];
    if ((corpo.ligada === true && !faixas.length) || faixas.length > 6) return campos(route, "faixas");
    for (let i = 1; i < faixas.length; i++) {
      const a = faixas[i - 1]!.ate, b = faixas[i]!.ate;
      if (a === null || (b !== null && b <= a)) return campos(route, "faixas");
    }
    if (!("alcadaConselho" in corpo) || (corpo.alcadaConselho !== null && typeof corpo.alcadaConselho !== "number")) return campos(route, "alcadaConselho");
    e.regras = { versao: e.regras.versao + 1, ligada: corpo.ligada === true, faixas, abaixoMinimo: corpo.abaixoMinimo === "BLOQUEIA" ? "BLOQUEIA" : "MOTIVO",
      prazoDias: Number(corpo.prazoDias), validadeDias: Number(corpo.validadeDias), linkDias: Number(corpo.linkDias) };
    e.alcadaGravada = corpo.alcadaConselho as number | null;
    x.gravarAlcada?.(e.alcadaGravada);
    return route.fulfill({ json: { versao: e.regras.versao } });
  }

  if (!x.pode("orcamentos.ver")) return erro(route, 403, "FORBIDDEN");
  const edita = x.pode("orcamentos.editar");

  if (caminho === "/v1/condominio/orcamentos" && metodo === "GET") {
    const filtro = url.searchParams.get("filtro") ?? "EM_ANDAMENTO";
    const DO_FILTRO: Record<string, (o: OrcamentoFalso) => boolean> = {
      EM_ANDAMENTO: (o) => ABERTO.includes(o.estado), DECIDIDOS: (o) => ["ESCOLHIDA", "COMPRANDO", "ENTREGUE"].includes(o.estado),
      ENCERRADOS: (o) => o.estado === "ENTREGUE", CANCELADOS: (o) => o.estado === "CANCELADO",
    };
    if (!DO_FILTRO[filtro]) return campos(route, "filtro");
    for (const o of e.orcamentos) conferir(o, x);
    const conta = (f: (o: OrcamentoFalso) => boolean) => e.orcamentos.filter(f).length;
    return route.fulfill({ json: { hoje: HOJE, filtro, pode: { criar: edita, decidir: x.pode("orcamentos.decidir") },
      contagens: {
        emAndamento: conta(DO_FILTRO.EM_ANDAMENTO!), decididos: conta(DO_FILTRO.DECIDIDOS!), encerrados: conta(DO_FILTRO.ENCERRADOS!), cancelados: conta(DO_FILTRO.CANCELADOS!),
        pedindo: conta((o) => o.estado === "PEDINDO"),
        comparar: conta((o) => o.estado === "COMPARANDO" && (!o.fechamentoVisto || recebidas(o) === 0)),
        decidir: conta((o) => o.estado === "COMPARANDO" && o.fechamentoVisto && recebidas(o) > 0),
        comprando: conta((o) => ["ESCOLHIDA", "COMPRANDO"].includes(o.estado)),
      },
      orcamentos: e.orcamentos.filter(DO_FILTRO[filtro]!).map(resumoJson) } });
  }
  if (caminho === "/v1/condominio/orcamentos/opcoes") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const eu = quemSou(x);
    return route.fulfill({ json: { hoje: HOJE, quem: { nome: eu.nome, cargo: eu.cargo, condominio: "Residencial Ipê" },
      prestadores: e.prestadores.map((p) => ({ id: p.id, nome: p.nome, servico: p.servico, canal: p.canal, servicosFeitos: p.servicosFeitos })),
      manutencoes: x.manutencoes(), pedidos: x.pedidos(), locais: ["Casa de bombas", "Hall da Torre A", "Garagem"],
      regras: { ligada: e.regras.ligada, faixas: e.regras.faixas, abaixoMinimo: e.regras.abaixoMinimo, prazoDias: e.regras.prazoDias, validadeDias: e.regras.validadeDias, linkDias: e.regras.linkDias, alcadaConselho: x.alcada() },
      conselho: x.conselho() } });
  }
  if (caminho === "/v1/condominio/orcamentos" && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    anota();
    if (texto("titulo").length < 3) return campos(route, "titulo");
    if (texto("descricao").length < 3) return campos(route, "descricao");
    if (corpo.tipo && corpo.tipo !== "SERVICO") return motivo(route, "TIPO_ITENS_DEPOIS");
    const prazo = texto("prazoPropostas");
    if (!prazo || Date.parse(prazo) <= Date.parse(AGORA) + HORA) return campos(route, "prazoPropostas");
    const mandar = corpo.mandar !== false;
    const lista = (corpo.convites as Record<string, unknown>[] | undefined) ?? [];
    if (mandar && !lista.length) return campos(route, "convites");
    if (lista.length > 20) return motivo(route, "LIMITE_CONVITES");
    if (corpo.manutencaoId && corpo.pedidoId) return campos(route, "pedidoId");
    const manut = corpo.manutencaoId ? x.manutencoes().find((m) => m.id === corpo.manutencaoId) : null;
    if (corpo.manutencaoId && !manut) return campos(route, "manutencaoId");
    const o = orcamento({ titulo: texto("titulo"), descricao: texto("descricao"), local: texto("local") || null, manutencaoId: manut?.id ?? null, manutencaoTitulo: manut?.titulo ?? null,
      pedidoId: (corpo.pedidoId as string) || null, pedidoTexto: corpo.pedidoId ? x.pedidos().find((p) => p.id === corpo.pedidoId)?.titulo ?? null : null,
      valorEstimado: typeof corpo.valorEstimado === "number" ? corpo.valorEstimado : null, prazoPropostas: new Date(prazo).toISOString(), validadeMinimaDias: Number(corpo.validadeMinimaDias) || e.regras.validadeDias,
      criadoEm: AGORA, estado: mandar ? "PEDINDO" : "RASCUNHO", cuidador: quemSou(x) });
    for (const d of lista) {
      const c = novoConvite(e, o, d);
      if (typeof c === "string") return campos(route, "convites", c);
      o.convites.push(c);
    }
    e.orcamentos.unshift(o);
    if (mandar) for (const c of o.convites) mandarConvite(c);
    hist(o, "orcamento.criado", mandar ? `${primeiro} criou o orçamento e mandou ${o.convites.length === 1 ? "1 convite" : `${o.convites.length} convites`}` : `${primeiro} criou o orçamento`);
    return route.fulfill({ status: 201, json: { id: o.id, links: mandar ? o.convites.map((c) => linkDe(x, o, c)) : [], estado: o.estado, versao: o.versao } });
  }

  const anexo = /^\/v1\/condominio\/orcamentos\/anexos\/([^/]+)\/(verificar|link|tirar)$/.exec(caminho);
  if (anexo) {
    const o = e.orcamentos.find((y) => y.arquivos.some((a) => a.id === anexo[1]));
    const a = o?.arquivos.find((y) => y.id === anexo[1]);
    if (!o || !a) return erro(route, 404, "NOT_FOUND");
    if (anexo[2] === "verificar") {
      if (a.situacao === "LIBERADO") return motivo(route, "JA_VERIFICADO");
      a.situacao = "LIBERADO";
      if (a.parte === "NOTA_FISCAL" && o.compra) { o.compra.notaFiscalId = a.id; o.versao++; hist(o, "orcamento.nota_fiscal", "Nota fiscal anexada", "ok"); }
      return route.fulfill({ json: { situacao: "LIBERADO" } });
    }
    if (anexo[2] === "link") return a.situacao === "LIBERADO" ? route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, tipo: a.tipo, expiraEm: depois(1) } }) : motivo(route, "ARQUIVO_NAO_LIBERADO");
    anota();
    o.arquivos = o.arquivos.filter((y) => y !== a);
    return route.fulfill({ json: { ok: true } });
  }

  const r = /^\/v1\/condominio\/orcamentos\/([^/]+)(?:\/([a-z-]+))?(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(caminho);
  if (!r) return erro(route, 404, "NOT_FOUND");
  const o = e.orcamentos.find((y) => y.id === r[1]);
  if (!o) return erro(route, 404, "NOT_FOUND");
  conferir(o, x);
  const acao = r[2];
  if (!acao && metodo === "GET") { if (edita && o.estado === "COMPARANDO") o.fechamentoVisto = true; return route.fulfill({ json: detalheJson(e, x, o) }); }
  if (acao === "comparacao") { if (edita && o.estado === "COMPARANDO") o.fechamentoVisto = true; return route.fulfill({ json: comparacaoJson(e, x, o) }); }
  anota();
  const versaoConfere = () => corpo.versao === o.versao;
  if (!acao && metodo === "PUT") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (!versaoConfere()) return conflito(route, o);
    if (!["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
    if (texto("titulo").length < 3) return campos(route, "titulo");
    if (texto("descricao").length < 3) return campos(route, "descricao");
    Object.assign(o, { titulo: texto("titulo"), descricao: texto("descricao"), local: texto("local") || null, valorEstimado: typeof corpo.valorEstimado === "number" ? corpo.valorEstimado : null, versao: o.versao + 1 });
    if (recebidas(o)) { o.editadoEm = AGORA; hist(o, "orcamento.alterado", "O pedido foi alterado. Quem já respondeu foi avisado no link"); } else hist(o, "orcamento.alterado", "O pedido foi alterado");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "anexos" && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const parte = corpo.parte === "NOTA_FISCAL" ? "NOTA_FISCAL" : "PEDIDO";
    if (corpo.parte !== undefined && corpo.parte !== "PEDIDO" && corpo.parte !== "NOTA_FISCAL") return campos(route, "parte");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(corpo.tipo))) return motivo(route, "TIPO_NAO_ACEITO");
    if (Number(corpo.tamanho) > 10 * 1024 * 1024) return motivo(route, "ARQUIVO_GRANDE");
    if (parte === "NOTA_FISCAL" && !["COMPRANDO", "ENTREGUE"].includes(o.estado)) return motivo(route, "NAO_ESTA_COMPRANDO");
    if (parte === "PEDIDO" && o.arquivos.filter((a) => a.parte === "PEDIDO").length >= 10) return motivo(route, "LIMITE_ARQUIVOS_ORCAMENTO");
    const a: ArquivoFalso = { id: novoId(), parte, nome: String(corpo.nome), tipo: String(corpo.tipo), tamanho: Number(corpo.tamanho), situacao: "ENVIANDO", conviteId: null, propostaId: null };
    o.arquivos.push(a);
    return route.fulfill({ status: 201, json: { arquivoId: a.id, envio: { url: `/api/v1/armazenamento/${a.id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  if (acao === "convites" && !r[3] && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (!["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
    const lista = (corpo.convites as Record<string, unknown>[] | undefined) ?? [];
    if (!lista.length) return campos(route, "convites");
    if (o.estado === "COMPARANDO") return motivo(route, "PRAZO_FECHADO");
    if (o.convites.length + lista.length > 20) return motivo(route, "LIMITE_CONVITES");
    const novos: ConviteFalso[] = [];
    for (const d of lista) {
      const c = novoConvite(e, o, d);
      if (typeof c === "string") return campos(route, "convites", c);
      novos.push(c);
    }
    o.convites.push(...novos);
    const manda = o.estado === "PEDINDO";
    if (manda) for (const c of novos) mandarConvite(c);
    for (const c of novos) hist(o, "orcamento.convidado", manda ? `${c.nome} foi convidado` : `${c.nome} entrou nos convidados`);
    o.versao++;
    return route.fulfill({ json: { versao: o.versao, links: manda ? novos.map((c) => linkDe(x, o, c)) : [] } });
  }
  if (acao === "mandar") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "RASCUNHO") return motivo(route, "JA_MANDADO");
    if (!convidados(o)) return campos(route, "convites");
    if (Date.parse(o.prazoPropostas) <= Date.parse(AGORA)) return campos(route, "prazoPropostas");
    if (!versaoConfere()) return conflito(route, o);
    o.estado = "PEDINDO"; o.versao++;
    const saem = validos(o).filter((c) => !c.mandadoEm);
    for (const c of saem) mandarConvite(c);
    hist(o, "orcamento.mandado", `${primeiro} mandou ${saem.length === 1 ? "1 convite" : `${saem.length} convites`}`);
    return route.fulfill({ json: { versao: o.versao, estado: o.estado, links: saem.map((c) => linkDe(x, o, c)) } });
  }
  if (acao === "convites" && r[3]) {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const c = o.convites.find((y) => y.id === r[3]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (r[4] === "reenviar") {
      if (c.estado === "REVOGADO") return motivo(route, "CONVITE_REVOGADO");
      if (!["PEDINDO", "ESCOLHIDA"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
      if (o.estado === "ESCOLHIDA" && !c.escolhido) return motivo(route, "NAO_ESCOLHIDO");
      mandarConvite(c); c.expiraEm = o.prazoPropostas;
      hist(o, "orcamento.reenviado", `Link mandado de novo para ${c.nome}`);
      return route.fulfill({ json: { link: linkDe(x, o, c) } });
    }
    if (r[4] === "revogar") {
      if (c.estado === "REVOGADO") return motivo(route, "CONVITE_REVOGADO");
      if (c.escolhido) return motivo(route, "CONVITE_ESCOLHIDO");
      if (!["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
      if (texto("motivo").length < 3) return campos(route, "motivo");
      c.estado = "REVOGADO"; c.revogado = { em: AGORA, motivo: texto("motivo") }; c.versao++;
      hist(o, "orcamento.revogado", `Link de ${c.nome} revogado`, "neutro");
      return route.fulfill({ json: { ok: true } });
    }
    if (r[4] === "pedir-confirmacao") {
      if (!["PEDINDO", "COMPARANDO"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
      if (c.estado === "REVOGADO") return motivo(route, "CONVITE_REVOGADO");
      const p = emUso(c);
      if (!p) return motivo(route, "SEM_PROPOSTA");
      if (!vencida(p)) return motivo(route, "PROPOSTA_VALE");
      p.confirmacaoPedidaEm = AGORA;
      mandarConvite(c);
      hist(o, "orcamento.pedir_confirmacao", `Pedida a confirmação do preço a ${c.nome}`);
      return route.fulfill({ json: { link: linkDe(x, o, c) } });
    }
    return erro(route, 404, "NOT_FOUND");
  }
  if (acao === "estender") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (!["PEDINDO", "COMPARANDO"].includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
    if (!versaoConfere()) return conflito(route, o);
    const prazo = texto("prazoPropostas");
    if (!prazo || Date.parse(prazo) <= Date.parse(AGORA) || Date.parse(prazo) <= Date.parse(o.prazoPropostas)) return campos(route, "prazoPropostas");
    o.prazoPropostas = new Date(prazo).toISOString(); o.fechadoEm = null; o.estado = "PEDINDO"; o.versao++;
    for (const c of validos(o)) c.expiraEm = o.prazoPropostas;
    hist(o, "orcamento.estendido", "Prazo estendido");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "fechar") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "PEDINDO") return motivo(route, "ORCAMENTO_FECHADO");
    if (!versaoConfere()) return conflito(route, o);
    o.fechadoEm = AGORA; o.prazoPropostas = AGORA; o.estado = "COMPARANDO"; o.fechamentoVisto = true; o.versao++;
    hist(o, "orcamento.fechado", `Prazo fechou com ${recebidas(o) === 1 ? "1 proposta" : `${recebidas(o)} propostas`}`);
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "escolher") {
    if (!x.pode("orcamentos.decidir")) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "COMPARANDO") return motivo(route, "NAO_ESTA_COMPARANDO");
    if (!versaoConfere()) return conflito(route, o);
    const c = o.convites.find((y) => y.propostas.some((p) => p.id === corpo.propostaId && p.emUso));
    const p = c?.propostas.find((q) => q.id === corpo.propostaId);
    if (!c || !p) return campos(route, "propostaId");
    if (c.estado === "REVOGADO") return motivo(route, "CONVITE_REVOGADO");
    if (vencida(p)) return motivo(route, "PROPOSTA_ORCAMENTO_VENCIDA");
    if (corpo.quemAprova !== "PESSOA" && corpo.quemAprova !== "CONSELHO") return campos(route, "quemAprova");
    const regra = regraDe(e, o, x.alcada());
    // A faixa que pede o conselho obriga; a alçada só avisa (passaAlcada).
    if (regra.ligada && regra.faixa?.quemAprova === "CONSELHO" && corpo.quemAprova !== "CONSELHO") return campos(route, "quemAprova");
    if (!regra.minimoAtendido && e.regras.abaixoMinimo === "BLOQUEIA" && e.regras.ligada) return motivo(route, "ABAIXO_DO_MINIMO");
    const menor = validos(o).map(emUso).filter((q): q is PropostaFalsa => !!q).map(total).sort((a, b) => a - b)[0] ?? total(p);
    if ((total(p) > menor || !regra.minimoAtendido) && texto("motivo").length < 3) return campos(route, "motivo");
    const quem = corpo.quemAprova as "PESSOA" | "CONSELHO";
    if (quem === "CONSELHO" && !x.conselho().podePedir) return motivo(route, "CONSELHO_VAZIO");
    const despesaId = quem === "CONSELHO" ? x.criarDespesa(o, total(p), c.nome) : null;
    o.escolha = { propostaId: p.id, conviteId: c.id, motivo: texto("motivo") || null, em: AGORA, por: x.eu.nome, quemAprova: quem, despesaId, despesaEstado: despesaId ? "AGUARDANDO" : null, aprovadaEm: despesaId ? null : AGORA };
    o.recusa = null;
    for (const y of o.convites) y.escolhido = y.id === c.id;
    o.estado = "ESCOLHIDA"; o.versao++;
    hist(o, "orcamento.escolhida", `Proposta de ${c.nome} escolhida`, "ok");
    if (despesaId) hist(o, "orcamento.ao_conselho", "Mandada ao conselho como despesa para aprovar");
    const passaAlcada = x.alcada() !== null && total(p) > x.alcada()!;
    return route.fulfill({ json: { estado: o.estado, versao: o.versao, passaAlcada, ...(despesaId ? { despesaId, links: [] } : {}) } });
  }
  if (acao === "desfazer-escolha") {
    if (!x.pode("orcamentos.decidir")) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "ESCOLHIDA" || !o.escolha) return motivo(route, "NAO_ESCOLHIDA");
    if (o.convites.find((c) => c.id === o.escolha!.conviteId)?.aceiteEm) return motivo(route, "JA_ACEITA");
    if (o.escolha.despesaId && o.escolha.despesaEstado !== "AGUARDANDO") return motivo(route, "JA_RESPONDIDA");
    if (!versaoConfere()) return conflito(route, o);
    o.escolha = null; o.estado = "COMPARANDO"; o.versao++;
    for (const y of o.convites) { y.escolhido = false; y.resultadoAvisadoEm = null; }
    hist(o, "orcamento.desfeita", "Escolha desfeita", "neutro");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "aceite-fora") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "ESCOLHIDA" || !o.escolha) return motivo(route, "NAO_ESCOLHIDA");
    const c = o.convites.find((y) => y.id === o.escolha!.conviteId)!;
    if (c.aceiteEm) return motivo(route, "JA_ACEITA");
    if (!versaoConfere()) return conflito(route, o);
    const data = texto("data");
    if (!data || data > HOJE) return campos(route, "data");
    c.aceiteEm = `${data}T12:00:00.000Z`; c.aceiteForaDoLink = true; c.aceiteNome = c.nome;
    if (!c.prestadorId) { const id = novoId(); e.prestadores.push({ id, nome: c.nome, servico: o.titulo, canal: c.canal, celular: c.celular, email: c.email, servicosFeitos: 0 }); c.prestadorId = id; }
    if (o.escolha.aprovadaEm) o.estado = "COMPRANDO";
    o.versao++;
    hist(o, "orcamento.aceite_fora", "Aceite registrado fora do link", "ok");
    return route.fulfill({ json: { estado: o.estado, versao: o.versao, prestadorId: c.prestadorId } });
  }
  if (acao === "compra") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "COMPRANDO") return motivo(route, "NAO_ESTA_COMPRANDO");
    if (o.compra) return motivo(route, "JA_COMPRADA");
    if (!versaoConfere()) return conflito(route, o);
    const data = texto("data");
    if (!data || data > HOJE) return campos(route, "data");
    if (typeof corpo.valorFechado !== "number" || corpo.valorFechado <= 0) return campos(route, "valorFechado");
    o.compra = { compradaEm: data, valorFechado: corpo.valorFechado, notaFiscalId: null }; o.versao++;
    hist(o, "orcamento.compra", "Compra registrada", "ok");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "entrega") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (o.estado !== "COMPRANDO") return motivo(route, "NAO_ESTA_COMPRANDO");
    if (!o.compra) return motivo(route, "SEM_COMPRA");
    if (!versaoConfere()) return conflito(route, o);
    const data = texto("data");
    if (!data || data > HOJE) return campos(route, "data");
    const parcial = corpo.parcial === true;
    o.entrega = { entregueEm: data, parcial, observacao: texto("observacao") || null };
    if (!parcial) o.estado = "ENTREGUE";
    o.versao++;
    hist(o, "orcamento.entrega", parcial ? "Entrega parcial registrada" : "Entrega registrada", "ok");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "cancelar") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (!ABERTO.includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
    if (!versaoConfere()) return conflito(route, o);
    if (texto("motivo").length < 3) return campos(route, "motivo");
    o.cancelado = { em: AGORA, motivo: texto("motivo"), por: x.eu.nome }; o.estado = "CANCELADO"; o.versao++;
    hist(o, "orcamento.cancelado", "Orçamento cancelado", "erro");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** O link do fornecedor, sem conta (/o/<código>; quadros 476 a 478). */
export async function rotasOrcamentoPublico(route: Route, e: EstadoOrcamentos, caminho: string, metodo: string, corpo: Record<string, unknown>): Promise<void | null> {
  const r = /^\/v1\/publico\/orcamento\/([^/]+)(?:\/([a-z-]+))?(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(caminho);
  if (!r) return null;
  const codigo = decodeURIComponent(r[1]!);
  if (codigo.length < 14 || codigo.length > 64) return erro(route, 404, "NOT_FOUND");
  let o: OrcamentoFalso | undefined;
  let c: ConviteFalso | undefined;
  let trocado = false;
  for (const y of e.orcamentos) {
    for (const z of y.convites) {
      if (z.codigo === codigo && z.mandadoEm) { o = y; c = z; }
      else if (z.codigosAntigos.includes(codigo)) { o = y; c = z; trocado = true; }
    }
  }
  if (!o || !c) return erro(route, 404, "NOT_FOUND");
  conferir(o);
  e.enviados.push({ caminho: `${metodo} ${caminho}`, corpo });
  const DECIDIDO = ["ESCOLHIDA", "COMPRANDO", "ENTREGUE"];
  // A ordem da 0317 (estado_link_orcamento).
  const estadoLink = (): { estado: string; motivo?: string } => {
    const p = emUso(c!);
    if (c!.estado === "REVOGADO") return { estado: "NAO_VALE", motivo: "REVOGADO" };
    if (trocado) return { estado: "NAO_VALE", motivo: "LINK_TROCADO" };
    if (o!.estado === "CANCELADO") return { estado: "CANCELADO" };
    if (c!.escolhido && DECIDIDO.includes(o!.estado)) return { estado: c!.aceiteEm ? "ACEITA" : "ESCOLHIDA" };
    if (DECIDIDO.includes(o!.estado)) return { estado: "NAO_ESCOLHIDA" };
    if (c!.estado === "RECUSOU") return { estado: "RECUSOU" };
    if (Date.parse(c!.expiraEm) + e.regras.linkDias * DIA < Date.parse(AGORA)) return { estado: "NAO_VALE", motivo: "VENCIDO" };
    if (p && p.confirmacaoPedidaEm && !p.confirmadaEm && vencida(p)) return { estado: "CONFIRMAR_PRECO" };
    if (o!.estado === "COMPARANDO" || Date.parse(c!.expiraEm) <= Date.parse(AGORA)) return { estado: p ? "ENVIADA" : "PRAZO_ACABOU" };
    return { estado: p ? "ENVIADA" : "VER" };
  };
  const json = () => {
    const s = estadoLink();
    if (s.estado === "NAO_VALE") return { condominio: "Residencial Ipê", estado: s.estado, motivo: s.motivo, fornecedor: { nome: c!.nome } };
    const p = emUso(c!);
    const esc = o!.escolha && c!.escolhido && DECIDIDO.includes(o!.estado) ? o!.escolha : null;
    const pEsc = esc ? o!.convites.flatMap((y) => y.propostas).find((q) => q.id === esc.propostaId) : null;
    return {
      condominio: "Residencial Ipê", estado: s.estado, hoje: HOJE, fornecedor: { nome: c!.nome, canal: c!.canal },
      pedido: { titulo: o!.titulo, descricao: o!.descricao, local: o!.local, tipo: o!.tipo, prazoPropostas: o!.prazoPropostas, prazoTexto: prazoTexto(o!.prazoPropostas),
        validadeMinimaDias: o!.validadeMinimaDias, ...(o!.editadoEm ? { alteradoEm: o!.editadoEm } : {}), quem: { nome: o!.cuidador.nome, cargo: o!.cuidador.cargo },
        arquivos: o!.arquivos.filter((a) => a.parte === "PEDIDO" && a.situacao === "LIBERADO").map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo })) },
      ...(p ? { proposta: propostaJson(o!, p) } : {}),
      versoes: c!.propostas.length,
      ...(c!.estado === "RECUSOU" ? { recusa: { em: c!.recusouEm, ...(c!.recusaMotivo ? { motivo: c!.recusaMotivo } : {}) } } : {}),
      ...(c!.aceiteEm ? { aceite: { em: c!.aceiteEm, nome: c!.aceiteNome ?? c!.nome } } : {}),
      ...(esc && pEsc ? { escolha: { em: esc.em, total: total(pEsc), aprovada: !!esc.aprovadaEm, esperaAprovacao: !esc.aprovadaEm } } : {}),
      pode: { recusar: s.estado === "VER", mandarProposta: ["VER", "ENVIADA", "CONFIRMAR_PRECO"].includes(s.estado) && o!.estado === "PEDINDO" && Date.parse(c!.expiraEm) > Date.parse(AGORA),
        confirmarPreco: s.estado === "CONFIRMAR_PRECO", aceitar: s.estado === "ESCOLHIDA" },
    };
  };
  if (!r[2] && metodo === "GET") { if (!trocado && c.estado !== "REVOGADO") { c.aberturas++; c.ultimaAberturaEm = AGORA; } return route.fulfill({ json: json() }); }
  if (r[2] === "arquivos" && r[3]) {
    const a = o.arquivos.find((y) => y.id === r[3] && y.situacao === "LIBERADO" && (y.parte === "PEDIDO" || y.conviteId === c!.id));
    return a ? route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, nome: a.nome, tipo: a.tipo } }) : erro(route, 404, "NOT_FOUND");
  }
  const s = estadoLink();
  const naoVale = () => motivo(route, s.motivo === "LINK_TROCADO" ? "LINK_TROCADO" : "REVOGADO");
  const prazoAberto = o.estado === "PEDINDO" && Date.parse(c.expiraEm) > Date.parse(AGORA);
  if (r[2] === "pdf" && !r[3] && metodo === "POST") {
    if (s.estado === "NAO_VALE") return naoVale();
    if (!prazoAberto) return motivo(route, "PRAZO_PROPOSTAS_ACABOU");
    if (corpo.tipo !== "application/pdf") return motivo(route, "PROPOSTA_SO_PDF");
    if (Number(corpo.tamanho) > 10 * 1024 * 1024) return motivo(route, "ARQUIVO_GRANDE");
    if (o.arquivos.filter((a) => a.conviteId === c!.id).length >= 10) return motivo(route, "LIMITE_ARQUIVOS_ORCAMENTO");
    const a: ArquivoFalso = { id: novoId(), parte: "PROPOSTA", nome: String(corpo.nome), tipo: "application/pdf", tamanho: Number(corpo.tamanho), situacao: "ENVIANDO", conviteId: c.id, propostaId: null };
    o.arquivos.push(a);
    return route.fulfill({ status: 201, json: { arquivoId: a.id, envio: { url: `/api/v1/armazenamento/${a.id}`, metodo: "PUT", tipo: "application/pdf" } } });
  }
  if (r[2] === "pdf" && r[3] && r[4] === "verificar") {
    const a = o.arquivos.find((y) => y.id === r[3] && y.conviteId === c!.id);
    if (!a) return erro(route, 404, "NOT_FOUND");
    if (a.situacao === "LIBERADO") return motivo(route, "JA_VERIFICADO");
    a.situacao = "LIBERADO";
    return route.fulfill({ json: { situacao: "LIBERADO" } });
  }
  if (s.estado === "NAO_VALE") return naoVale();
  if (r[2] === "recusar") {
    if (s.estado === "CANCELADO" || s.estado === "PRAZO_ACABOU" || !prazoAberto) return motivo(route, "PRAZO_PROPOSTAS_ACABOU");
    if (s.estado !== "VER") return motivo(route, "JA_RESPONDEU");
    c.estado = "RECUSOU"; c.recusaMotivo = String(corpo.motivo ?? "").trim() || null; c.recusouEm = AGORA; c.versao++;
    o.historico.unshift(ev(AGORA, "orcamento.recusou", `${c.nome} recusou o convite`, "neutro"));
    return route.fulfill({ json: json() });
  }
  if (r[2] === "proposta") {
    if (!["VER", "ENVIADA", "CONFIRMAR_PRECO"].includes(s.estado) || !prazoAberto) return motivo(route, "PRAZO_PROPOSTAS_ACABOU");
    const faltam: string[] = [];
    if (typeof corpo.valor !== "number" || corpo.valor <= 0) faltam.push("valor");
    if (corpo.freteIncluso !== true && (typeof corpo.frete !== "number" || corpo.frete < 0)) faltam.push("frete");
    if (String(corpo.prazoExecucao ?? "").trim().length < 1) faltam.push("prazoExecucao");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(corpo.validaAte)) || String(corpo.validaAte) < HOJE) faltam.push("validaAte");
    if (String(corpo.inclui ?? "").trim().length < 3) faltam.push("inclui");
    const pdf = corpo.pdfArquivoId ? o.arquivos.find((a) => a.id === corpo.pdfArquivoId && a.conviteId === c!.id && a.situacao === "LIBERADO") : null;
    if (corpo.pdfArquivoId && !pdf) faltam.push("pdfArquivoId");
    if (faltam.length) return campos(route, ...faltam);
    for (const q of c.propostas) q.emUso = false;
    const nova = proposta({ numero: c.propostas.length + 1, valor: corpo.valor as number, frete: corpo.freteIncluso === true ? 0 : (corpo.frete as number), freteIncluso: corpo.freteIncluso === true,
      marcaModelo: String(corpo.marcaModelo ?? "").trim() || null, prazoExecucao: String(corpo.prazoExecucao).trim(), garantia: String(corpo.garantia ?? "").trim() || null,
      validaAte: String(corpo.validaAte), pagamento: String(corpo.pagamento ?? "").trim() || null, inclui: String(corpo.inclui).trim(), naoInclui: String(corpo.naoInclui ?? "").trim() || null,
      pdfId: pdf?.id ?? null, enviadaEm: AGORA });
    if (pdf) pdf.propostaId = nova.id;
    c.propostas.push(nova); c.estado = "RESPONDEU"; c.versao++;
    o.historico.unshift(ev(AGORA, "orcamento.proposta", `${c.nome} mandou a proposta${nova.numero > 1 ? ` (versão ${nova.numero})` : ""}`, "violeta"));
    const dias = Math.round((Date.parse(`${nova.validaAte}T12:00:00Z`) - Date.parse(`${HOJE}T12:00:00Z`)) / DIA);
    const avisoValidade = dias < o.validadeMinimaDias ? `O condomínio pediu validade de pelo menos ${o.validadeMinimaDias} dias; a sua vale ${dias} dias` : null;
    return route.fulfill({ json: { ...json(), numero: nova.numero, ...(avisoValidade ? { avisoValidade } : {}) } });
  }
  if (r[2] === "confirmar-preco") {
    const p = emUso(c);
    if (!p) return motivo(route, "SEM_PROPOSTA");
    if (s.estado === "CANCELADO" || DECIDIDO.includes(o.estado)) return motivo(route, "ORCAMENTO_FECHADO");
    if (s.estado !== "CONFIRMAR_PRECO") return motivo(route, "SEM_PEDIDO_DE_CONFIRMACAO");
    const validaAte = String(corpo.validaAte ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validaAte) || validaAte < HOJE) return campos(route, "validaAte");
    p.validaAte = validaAte; p.confirmadaEm = AGORA;
    o.historico.unshift(ev(AGORA, "orcamento.preco_confirmado", `${c.nome} confirmou o preço`, "ok"));
    return route.fulfill({ json: json() });
  }
  if (r[2] === "aceitar") {
    if (s.estado === "ACEITA") return motivo(route, "JA_ACEITA");
    if (s.estado === "NAO_ESCOLHIDA") return motivo(route, "NAO_ESCOLHIDO");
    if (s.estado !== "ESCOLHIDA") return motivo(route, "NAO_ESPERA_ACEITE");
    const nome = String(corpo.nome ?? "").trim();
    if (nome.length < 2 || nome.length > 120) return campos(route, "nome");
    c.aceiteEm = AGORA; c.aceiteNome = nome; c.versao++;
    if (o.escolha?.aprovadaEm) o.estado = "COMPRANDO";
    if (!c.prestadorId) { const id = novoId(); e.prestadores.push({ id, nome: c.nome, servico: o.titulo, canal: c.canal, celular: c.celular, email: c.email, servicosFeitos: 0 }); c.prestadorId = id; }
    o.historico.unshift(ev(AGORA, "orcamento.aceite", `${c.nome} aceitou fazer o serviço`, "ok"));
    return route.fulfill({ json: json() });
  }
  return erro(route, 404, "NOT_FOUND");
}

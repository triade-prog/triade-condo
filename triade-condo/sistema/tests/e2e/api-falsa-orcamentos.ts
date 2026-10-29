// Orçamentos e compras (R8, OC-01 a OC-07 e OC-10; quadros 470 a 486) na API falsa da Plataforma,
// no contrato do plano (docs/orcamentos-r8/plano-0317, seção API). As regras de verdade ficam no
// banco (pgTAP 064) e na API (Deno); aqui só o bastante para a tela. Os dados de exemplo são os
// dos quadros: a troca da bomba de recalque 2 com HidroPress, Bombas Brasília e Águia Hidráulica.
import type { Route } from "@playwright/test";
import { AGORA } from "./api-falsa-pedidos";

const HORA = 3600_000;
const DIA = 24 * HORA;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();
const diaDe = (iso: string) => new Date(Date.parse(iso) - 3 * HORA).toISOString().slice(0, 10);
const HOJE = diaDe(AGORA);
const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
let n = 0;
const novoId = () => `5c6d7e8f-9a0b-4c1d-8e2f-${String(++n).padStart(12, "0")}`;

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
  estado: "CONVIDADO" | "RECUSOU" | "RESPONDEU" | "REVOGADO"; recusaMotivo: string | null; recusouEm: string | null; aberturas: number;
  codigo: string; codigosAntigos: string[]; expiraEm: string; revogado: { em: string; motivo: string } | null; escolhido: boolean;
  aceiteEm: string | null; aceiteNome: string | null; aceiteForaDoLink: boolean; resultadoAvisadoEm: string | null; versao: number; propostas: PropostaFalsa[];
}
export interface ArquivoFalso { id: string; nome: string; tipo: string; tamanho: number; situacao: "ENVIANDO" | "LIBERADO"; conviteId: string | null; propostaId: string | null }
export interface OrcamentoFalso {
  id: string; titulo: string; descricao: string; local: string | null; tipo: "SERVICO"; manutencaoId: string | null; manutencaoTitulo: string | null;
  pedidoId: string | null; pedidoTexto: string | null; origemPreventiva: string | null; valorEstimado: number | null; prazoPropostas: string; validadeMinimaDias: number;
  cuidador: string; criadoEm: string; editadoEm: string | null; estado: string; fechadoEm: string | null;
  escolha: { propostaId: string; conviteId: string; motivo: string | null; em: string; por: string; quemAprova: "PESSOA" | "CONSELHO"; despesaId: string | null; despesaEstado: string | null; aprovadaEm: string | null } | null;
  compra: { compradaEm: string; valorFechado: number; notaFiscalId: string | null } | null;
  entrega: { entregueEm: string; parcial: boolean; observacao: string | null } | null;
  cancelado: { em: string; motivo: string } | null;
  versao: number; convites: ConviteFalso[]; arquivos: ArquivoFalso[]; historico: { em: string; texto: string; tom: string }[];
}
export interface RegrasFalsas { versao: number; ligada: boolean; faixas: { ate: number | null; minimo: number; quemAprova: "SINDICO" | "CONSELHO" }[]; abaixoMinimo: "MOTIVO" | "BLOQUEIA"; prazoDias: number; validadeDias: number; linkDias: number }

export interface EstadoOrcamentos {
  orcamentos: OrcamentoFalso[];
  regras: RegrasFalsas;
  prestadores: { id: string; nome: string; servico: string; canal: "WHATSAPP" | "EMAIL"; celular: string | null; email: string | null; servicosFeitos: number }[];
  enviados: { caminho: string; corpo: Record<string, unknown> }[];
  /** As despesas que nasceram das escolhas mandadas ao conselho (id → estado). */
  despesas: Record<string, string>;
}

export function criarOrcamentos(): EstadoOrcamentos {
  return {
    orcamentos: [], enviados: [], despesas: {},
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

const proposta = (p: Partial<PropostaFalsa> & { numero: number; valor: number; validaAte: string; enviadaEm: string; inclui: string; prazoExecucao: string }): PropostaFalsa => ({
  id: novoId(), frete: 0, freteIncluso: true, marcaModelo: null, garantia: null, pagamento: null, naoInclui: null, pdfId: null, confirmadaEm: null, confirmacaoPedidaEm: null, emUso: true, ...p,
});
const convite = (c: Partial<ConviteFalso> & { nome: string; codigo: string; expiraEm: string }): ConviteFalso => ({
  id: novoId(), prestadorId: null, celular: null, email: null, canal: "WHATSAPP", estado: "CONVIDADO", recusaMotivo: null, recusouEm: null, aberturas: 0, codigosAntigos: [],
  revogado: null, escolhido: false, aceiteEm: null, aceiteNome: null, aceiteForaDoLink: false, resultadoAvisadoEm: null, versao: 1, propostas: [], ...c,
});
const orcamento = (o: Partial<OrcamentoFalso> & { titulo: string; descricao: string; prazoPropostas: string; criadoEm: string }): OrcamentoFalso => ({
  id: novoId(), local: null, tipo: "SERVICO", manutencaoId: null, manutencaoTitulo: null, pedidoId: null, pedidoTexto: null, origemPreventiva: null, valorEstimado: null,
  validadeMinimaDias: 15, cuidador: "Ana Souza", editadoEm: null, estado: "PEDINDO", fechadoEm: null, escolha: null, compra: null, entrega: null, cancelado: null, versao: 1,
  convites: [], arquivos: [], historico: [], ...o,
});

/** Os quadros 470 a 486: a bomba com 3 propostas (uma vencida) e uma recusa, a pintura sem propostas,
 * os extintores escolhidos sem aceite há 6 dias e a caixa d'água entregue. */
export function semearOrcamentos(e: EstadoOrcamentos, manutencao?: { id: string; titulo: string }) {
  const [hidro, brasilia, , fogo] = e.prestadores;
  const prazoBomba = depois(-48);
  const bomba = orcamento({
    titulo: "Troca da bomba de recalque 2", local: "Casa de bombas · Bomba 2",
    descricao: "Bomba centrífuga equivalente à atual (3 cv, trifásica), instalação, retirada da bomba velha e teste com a caixa cheia. Informar marca e modelo.",
    manutencaoId: manutencao?.id ?? null, manutencaoTitulo: manutencao?.titulo ?? "Bomba de recalque com ruído", valorEstimado: 650000,
    prazoPropostas: prazoBomba, criadoEm: depois(-8 * 24), fechadoEm: prazoBomba,
    convites: [
      convite({ prestadorId: hidro!.id, nome: hidro!.nome, celular: hidro!.celular, canal: "WHATSAPP", codigo: "link-hidropress", expiraEm: prazoBomba, estado: "RESPONDEU", aberturas: 3,
        propostas: [proposta({ numero: 1, valor: 648000, marcaModelo: "KSB Hydrobloc C 3 cv", prazoExecucao: "5 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 25),
          pagamento: "2 vezes (entrada e entrega)", inclui: "Bomba e instalação\nRetirada da velha\nTeste com a caixa cheia", naoInclui: "Quadro elétrico", enviadaEm: depois(-5 * 24) })] }),
      convite({ prestadorId: brasilia!.id, nome: brasilia!.nome, email: brasilia!.email, canal: "EMAIL", codigo: "link-brasilia", expiraEm: prazoBomba, estado: "RESPONDEU", aberturas: 5,
        propostas: [
          proposta({ numero: 1, valor: 642000, marcaModelo: "Dancor CAM-W 3 cv", prazoExecucao: "10 dias úteis", garantia: "6 meses", validaAte: somarDias(HOJE, 20), pagamento: "30 dias depois",
            inclui: "Bomba e instalação\nTeste com a caixa cheia", naoInclui: "Retirada da velha: R$ 250,00 à parte", faltaAlgo: true, enviadaEm: depois(-7 * 24), emUso: false }),
          proposta({ numero: 2, valor: 595000, frete: 18000, freteIncluso: false, marcaModelo: "Dancor CAM-W 3 cv", prazoExecucao: "10 dias úteis", garantia: "6 meses", validaAte: somarDias(HOJE, -1),
            pagamento: "30 dias depois", inclui: "Bomba e instalação\nTeste com a caixa cheia", naoInclui: "Retirada da velha: R$ 250,00 à parte", faltaAlgo: true, enviadaEm: depois(-3 * 24) }),
        ] }),
      convite({ nome: "Águia Hidráulica", celular: "61981234567", canal: "WHATSAPP", codigo: "link-aguia", expiraEm: prazoBomba, estado: "RESPONDEU", aberturas: 2,
        propostas: [proposta({ numero: 1, valor: 720000, marcaModelo: "Schneider BC-92 S 3 cv", prazoExecucao: "3 dias úteis", garantia: "24 meses", validaAte: somarDias(HOJE, 30),
          pagamento: "À vista, na entrega", inclui: "Bomba e instalação\nRetirada da velha\nRevisão do quadro elétrico\nTeste", naoInclui: "Tubulação corroída", enviadaEm: depois(-4 * 24) })] }),
      convite({ nome: "Central das Bombas", celular: "61981230099", canal: "WHATSAPP", codigo: "link-central", expiraEm: prazoBomba, estado: "RECUSOU", recusaMotivo: "Não atendemos Águas Claras",
        recusouEm: depois(-7 * 24), aberturas: 1 }),
    ],
    historico: [
      { em: prazoBomba, texto: "Prazo fechou com 3 propostas", tom: "violeta" },
      { em: depois(-3 * 24), texto: "Bombas Brasília mandou a versão 2 (de R$ 6.420,00 para R$ 6.130,00). A versão 1 fica guardada.", tom: "violeta" },
      { em: depois(-7 * 24), texto: "Central das Bombas recusou o convite", tom: "neutro" },
      { em: depois(-8 * 24), texto: "Ana criou o orçamento e mandou 4 convites", tom: "violeta" },
    ],
  });
  bomba.arquivos.push({ id: novoId(), nome: "Bomba 2 com vazamento.jpg", tipo: "image/jpeg", tamanho: 1_200_000, situacao: "LIBERADO", conviteId: null, propostaId: null },
    { id: novoId(), nome: "Placa da bomba.jpg", tipo: "image/jpeg", tamanho: 800_000, situacao: "LIBERADO", conviteId: null, propostaId: null });
  const aguia = bomba.convites[2]!;
  bomba.arquivos.push({ id: novoId(), nome: "Proposta 0412 Águia Hidráulica.pdf", tipo: "application/pdf", tamanho: 90_000, situacao: "LIBERADO", conviteId: aguia.id, propostaId: aguia.propostas[0]!.id });
  aguia.propostas[0]!.pdfId = bomba.arquivos[2]!.id;

  const prazoPintura = depois(21 * 24);
  const pintura = orcamento({
    titulo: "Pintura do hall da Torre A", local: "Hall da Torre A", descricao: "Pintura das paredes e do teto do hall, com massa corrida onde precisar. Tinta lavável.",
    prazoPropostas: prazoPintura, criadoEm: depois(-2 * 24), valorEstimado: 1200000,
    convites: [
      convite({ nome: "Pinturas Lima", celular: "61981230011", codigo: "link-lima", expiraEm: prazoPintura, aberturas: 1 }),
      convite({ nome: "Cor e Arte", celular: "61981230012", codigo: "link-cor", expiraEm: prazoPintura }),
      convite({ nome: "JB Pinturas", email: "jb@pinturas.com.br", canal: "EMAIL", codigo: "link-jb", expiraEm: prazoPintura }),
      convite({ nome: "Tintas do Lago", celular: "61981230014", codigo: "link-lago", expiraEm: prazoPintura, estado: "RECUSOU", recusaMotivo: null, recusouEm: depois(-24) }),
    ],
    historico: [{ em: depois(-24), texto: "Tintas do Lago recusou o convite", tom: "neutro" }, { em: depois(-2 * 24), texto: "Ana criou o orçamento e mandou 4 convites", tom: "violeta" }],
  });

  const prazoExt = depois(-9 * 24);
  const fogoZero = convite({ prestadorId: fogo!.id, nome: fogo!.nome, celular: fogo!.celular, codigo: "link-fogo", expiraEm: prazoExt, estado: "RESPONDEU", aberturas: 2, escolhido: true,
    propostas: [proposta({ numero: 1, valor: 98000, prazoExecucao: "2 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 10), inclui: "Recarga dos 12 extintores e troca dos lacres", enviadaEm: depois(-10 * 24) })] });
  const outra = convite({ nome: "Extintores Planalto", celular: "61981230021", codigo: "link-planalto", expiraEm: prazoExt, estado: "RESPONDEU", aberturas: 1, resultadoAvisadoEm: depois(-6 * 24),
    propostas: [proposta({ numero: 1, valor: 115000, prazoExecucao: "3 dias úteis", garantia: "12 meses", validaAte: somarDias(HOJE, 12), inclui: "Recarga dos 12 extintores", enviadaEm: depois(-10 * 24) })] });
  const extintores = orcamento({
    titulo: "Recarga dos extintores", local: "Todos os andares", descricao: "Recarga dos 12 extintores do prédio, com os lacres e o laudo.", origemPreventiva: "Preventiva · Extintores",
    prazoPropostas: prazoExt, criadoEm: depois(-12 * 24), fechadoEm: prazoExt, estado: "ESCOLHIDA", valorEstimado: 100000,
    escolha: { propostaId: fogoZero.propostas[0]!.id, conviteId: fogoZero.id, motivo: null, em: depois(-6 * 24), por: "Ana Souza", quemAprova: "PESSOA", despesaId: null, despesaEstado: null, aprovadaEm: depois(-6 * 24) },
    convites: [fogoZero, outra],
    historico: [{ em: depois(-6 * 24), texto: "Proposta de Fogo Zero escolhida", tom: "ok" }, { em: prazoExt, texto: "Prazo fechou com 2 propostas", tom: "violeta" }],
  });

  const prazoCaixa = depois(-20 * 24);
  const hidroServ = convite({ nome: "Hidro Serviços", celular: "61981230031", codigo: "link-hidroserv", expiraEm: prazoCaixa, estado: "RESPONDEU", aberturas: 2, escolhido: true, aceiteEm: depois(-15 * 24), aceiteNome: "Carlos Hidro",
    propostas: [proposta({ numero: 1, valor: 180000, prazoExecucao: "1 dia", garantia: "Laudo de potabilidade", validaAte: somarDias(HOJE, 5), inclui: "Limpeza das duas caixas e laudo", enviadaEm: depois(-22 * 24) })] });
  const caixa = orcamento({
    titulo: "Limpeza da caixa d’água", local: "Cobertura", descricao: "Limpeza semestral das duas caixas d’água, com laudo.", origemPreventiva: "Preventiva · Caixa d’água",
    prazoPropostas: prazoCaixa, criadoEm: depois(-25 * 24), fechadoEm: prazoCaixa, estado: "ENTREGUE", valorEstimado: 200000,
    escolha: { propostaId: hidroServ.propostas[0]!.id, conviteId: hidroServ.id, motivo: null, em: depois(-16 * 24), por: "Ana Souza", quemAprova: "PESSOA", despesaId: null, despesaEstado: null, aprovadaEm: depois(-16 * 24) },
    compra: { compradaEm: somarDias(HOJE, -14), valorFechado: 180000, notaFiscalId: null }, entrega: { entregueEm: somarDias(HOJE, -4), parcial: false, observacao: null },
    convites: [hidroServ, convite({ nome: "Limpa Tudo", celular: "61981230032", codigo: "link-limpa", expiraEm: prazoCaixa, estado: "RESPONDEU", aberturas: 1, resultadoAvisadoEm: depois(-16 * 24),
      propostas: [proposta({ numero: 1, valor: 210000, prazoExecucao: "1 dia", validaAte: somarDias(HOJE, 3), inclui: "Limpeza das duas caixas", enviadaEm: depois(-22 * 24) })] })],
    historico: [{ em: depois(-4 * 24), texto: "Entrega registrada", tom: "ok" }, { em: depois(-14 * 24), texto: "Compra registrada", tom: "ok" }, { em: depois(-15 * 24), texto: "Hidro Serviços aceitou fazer o serviço", tom: "ok" }],
  });
  e.orcamentos.push(bomba, pintura, extintores, caixa);
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const emUso = (c: ConviteFalso) => c.propostas.find((p) => p.emUso) ?? null;
const total = (p: PropostaFalsa) => p.valor + (p.freteIncluso ? 0 : p.frete);
const vencida = (p: PropostaFalsa) => p.validaAte < HOJE && !p.confirmadaEm;
const letra = (i: number) => String.fromCharCode(65 + i);
const prazoFechou = (o: OrcamentoFalso) => o.estado !== "RASCUNHO" && (!!o.fechadoEm || o.prazoPropostas <= AGORA);
const recebidas = (o: OrcamentoFalso) => o.convites.filter((c) => c.estado !== "REVOGADO" && emUso(c)).length;
const convidados = (o: OrcamentoFalso) => o.convites.filter((c) => c.estado !== "REVOGADO").length;
const mascarar = (c: ConviteFalso) => c.canal === "WHATSAPP" ? (c.celular ? `(${c.celular.slice(0, 2)}) ••••-${c.celular.slice(-4)}` : null) : (c.email ? `${c.email.slice(0, 2)}•••@${c.email.split("@")[1]}` : null);
const ABERTO = ["PEDINDO", "COMPARANDO", "ESCOLHIDA", "COMPRANDO"];

function faixaDoValor(e: EstadoOrcamentos, valor: number | null) {
  if (!e.regras.ligada || valor === null) return null;
  for (const f of e.regras.faixas) if (f.ate === null || valor <= f.ate) return f;
  return null;
}
function regraDe(e: EstadoOrcamentos, o: OrcamentoFalso, alcada: number | null) {
  const menor = o.convites.filter((c) => c.estado !== "REVOGADO").map(emUso).filter((p): p is PropostaFalsa => !!p).map(total).sort((a, b) => a - b)[0] ?? null;
  const valor = o.valorEstimado ?? menor;
  const faixa = faixaDoValor(e, valor);
  const i = faixa ? e.regras.faixas.indexOf(faixa) : -1;
  const anterior = i > 0 ? e.regras.faixas[i - 1]!.ate : null;
  const escolhidaTotal = o.escolha ? total(o.convites.flatMap((c) => c.propostas).find((p) => p.id === o.escolha!.propostaId)!) : null;
  return { ligada: e.regras.ligada, faixa, anterior, minimoAtendido: !faixa || recebidas(o) >= faixa.minimo, alcadaConselho: alcada,
    passaAlcada: alcada !== null && ((escolhidaTotal ?? menor ?? 0) > alcada) };
}

function situacao(o: OrcamentoFalso): string {
  if (o.estado === "PEDINDO" && prazoFechou(o)) return "Pronto para comparar";
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
function pedeAtencao(e: EstadoOrcamentos, o: OrcamentoFalso): string[] {
  const avisos: string[] = [];
  if (o.estado === "PEDINDO" && prazoFechou(o)) avisos.push("O prazo fechou: hora de comparar");
  const venc = o.convites.filter((c) => c.estado !== "REVOGADO").map(emUso).filter((p): p is PropostaFalsa => !!p && vencida(p)).length;
  if (venc && ["PEDINDO", "COMPARANDO"].includes(o.estado)) avisos.push(venc === 1 ? "1 proposta vencida" : `${venc} propostas vencidas`);
  const d = semAceiteDias(o);
  if (d !== null && d >= DIAS_SEM_ACEITE) avisos.push(`Faz ${d} dias que o fornecedor não confirma no link.`);
  void e;
  return avisos;
}
function origem(o: OrcamentoFalso) {
  if (o.manutencaoId || o.manutencaoTitulo) return { tipo: "MANUTENCAO", id: o.manutencaoId, texto: `Manutenção · ${o.manutencaoTitulo}` };
  if (o.pedidoId) return { tipo: "PEDIDO", id: o.pedidoId, texto: `Pedido · ${o.pedidoTexto}` };
  if (o.origemPreventiva) return { tipo: "PREVENTIVA", id: null, texto: o.origemPreventiva };
  return null;
}

/** O resumo do Início e do menu. */
export function resumoOrcamentos(e: EstadoOrcamentos) {
  const abertos = e.orcamentos.filter((o) => ABERTO.includes(o.estado));
  return {
    pedeAtencao: abertos.filter((o) => pedeAtencao(e, o).length).length,
    pedindo: abertos.filter((o) => o.estado === "PEDINDO" && !prazoFechou(o)).length,
    comparar: abertos.filter((o) => o.estado === "COMPARANDO" || (o.estado === "PEDINDO" && prazoFechou(o))).length,
  };
}

const listaJson = (e: EstadoOrcamentos, o: OrcamentoFalso) => {
  const esc = o.escolha ? o.convites.find((c) => c.id === o.escolha!.conviteId) : null;
  return {
    id: o.id, titulo: o.titulo, tipo: o.tipo, local: o.local, estado: o.estado, situacao: situacao(o), origem: origem(o),
    convidados: convidados(o), recebidas: recebidas(o), recusas: o.convites.filter((c) => c.estado === "RECUSOU").length,
    prazoPropostas: o.prazoPropostas, prazoFechou: prazoFechou(o),
    vencidas: o.convites.filter((c) => c.estado !== "REVOGADO").map(emUso).filter((p): p is PropostaFalsa => !!p && vencida(p)).length,
    escolhida: esc && o.escolha ? { nome: esc.nome, total: total(esc.propostas.find((p) => p.id === o.escolha!.propostaId)!) } : null,
    decididoEm: o.escolha?.em ?? null, concluidoEm: o.entrega && !o.entrega.parcial ? o.entrega.entregueEm : o.cancelado?.em ?? null,
    pedeAtencao: pedeAtencao(e, o), versao: o.versao,
  };
};

const propostaJson = (o: OrcamentoFalso, p: PropostaFalsa) => {
  const pdf = p.pdfId ? o.arquivos.find((a) => a.id === p.pdfId) : null;
  return { id: p.id, numero: p.numero, total: total(p), valor: p.valor, frete: p.frete, freteIncluso: p.freteIncluso, garantia: p.garantia, prazoExecucao: p.prazoExecucao,
    validaAte: p.validaAte, vencida: vencida(p), confirmacaoPedidaEm: p.confirmacaoPedidaEm, confirmadaEm: p.confirmadaEm, marcaModelo: p.marcaModelo, pagamento: p.pagamento,
    inclui: p.inclui, naoInclui: p.naoInclui, pdf: pdf ? { id: pdf.id, nome: pdf.nome } : null, enviadaEm: p.enviadaEm };
};

export interface ContextoOrcamentos {
  eu: { vinculo: string; nome: string };
  pode: (a: string) => boolean;
  sindico: boolean;
  alcada: () => number | null;
  conselho: () => { podePedir: boolean; titulares: number };
  manutencoes: () => { id: string; titulo: string; local: string | null }[];
  pedidos: () => { id: string; numero: string; titulo: string }[];
  /** Cria a despesa para aprovar no conselho e devolve o id. */
  criarDespesa: (o: OrcamentoFalso, valor: number, fornecedor: string) => string;
  despesaEstado: (id: string) => string | null;
}

function detalheJson(e: EstadoOrcamentos, x: ContextoOrcamentos, o: OrcamentoFalso) {
  const edita = x.pode("orcamentos.editar");
  const decide = x.pode("orcamentos.decidir");
  const fechou = prazoFechou(o);
  const esc = o.escolha ? o.convites.find((c) => c.id === o.escolha!.conviteId) ?? null : null;
  const propEsc = o.escolha ? o.convites.flatMap((c) => c.propostas).find((p) => p.id === o.escolha!.propostaId) ?? null : null;
  const despesaEstado = o.escolha?.despesaId ? x.despesaEstado(o.escolha.despesaId) ?? o.escolha.despesaEstado : null;
  const aprovadaEm = o.escolha ? (o.escolha.aprovadaEm ?? (despesaEstado === "APROVADA" ? AGORA : null)) : null;
  const aberto = ABERTO.includes(o.estado);
  const comparando = o.estado === "COMPARANDO" || (o.estado === "PEDINDO" && fechou);
  const dias = semAceiteDias(o);
  const historico = [...o.historico];
  return {
    orcamento: {
      id: o.id, titulo: o.titulo, descricao: o.descricao, local: o.local, tipo: o.tipo, estado: o.estado, situacao: situacao(o), origem: origem(o), valorEstimado: o.valorEstimado,
      prazoPropostas: o.prazoPropostas, prazoFechou: fechou, validadeMinimaDias: o.validadeMinimaDias, cuidador: { nome: o.cuidador, cargo: "síndica" },
      criadoEm: o.criadoEm, criadoPor: o.cuidador, editadoEm: o.editadoEm, convidados: convidados(o), recebidas: recebidas(o), recusas: o.convites.filter((c) => c.estado === "RECUSOU").length,
      regra: regraDe(e, o, x.alcada()),
      escolha: o.escolha && esc && propEsc ? {
        propostaId: o.escolha.propostaId, convite: { id: esc.id, letra: letra(o.convites.indexOf(esc)), nome: esc.nome, prestadorId: esc.prestadorId }, total: total(propEsc),
        motivo: o.escolha.motivo, quemAprova: o.escolha.quemAprova, escolhidaEm: o.escolha.em, escolhidaPor: o.escolha.por, despesaId: o.escolha.despesaId, despesaEstado,
        aprovadaEm, aprovadaTexto: o.escolha.quemAprova === "CONSELHO" && aprovadaEm ? "O conselho aprovou com 3 de 4 votos" : null,
        aceiteEm: esc.aceiteEm, aceiteNome: esc.aceiteNome, aceiteForaDoLink: esc.aceiteForaDoLink, semAceiteHaDias: dias,
        avisadas: o.convites.filter((c) => c.resultadoAvisadoEm).length,
      } : null,
      compra: o.compra ? { compradaEm: o.compra.compradaEm, valorFechado: o.compra.valorFechado, notaFiscal: o.compra.notaFiscalId ? { id: o.compra.notaFiscalId, nome: o.arquivos.find((a) => a.id === o.compra!.notaFiscalId)?.nome ?? "Nota fiscal" } : null } : null,
      entrega: o.entrega, cancelado: o.cancelado, versao: o.versao,
    },
    convites: o.convites.map((c, i) => {
      const p = emUso(c);
      return { id: c.id, letra: letra(i), nome: c.nome, origem: c.prestadorId ? "PRESTADOR" : "LINK", prestadorId: c.prestadorId, canal: c.canal, contatoMascarado: mascarar(c),
        estado: c.estado, aberturas: c.aberturas, recusaMotivo: c.recusaMotivo, recusouEm: c.recusouEm, propostaEmUso: p ? propostaJson(o, p) : null, versoes: c.propostas.length,
        revogado: c.revogado, escolhido: c.escolhido, versao: c.versao };
    }),
    arquivos: o.arquivos.filter((a) => !a.conviteId).map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, situacao: a.situacao })),
    historico,
    pode: {
      editar: edita && ["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado), convidar: edita && ["RASCUNHO", "PEDINDO", "COMPARANDO"].includes(o.estado),
      estender: edita && ["PEDINDO", "COMPARANDO"].includes(o.estado), fechar: edita && o.estado === "PEDINDO" && !fechou,
      comparar: (o.estado === "PEDINDO" || o.estado === "COMPARANDO") && recebidas(o) > 0, decidir: decide && comparando && recebidas(o) > 0,
      desfazerEscolha: decide && o.estado === "ESCOLHIDA" && !esc?.aceiteEm && despesaEstado !== "APROVADA",
      registrarCompra: edita && o.estado === "COMPRANDO" && !o.compra, registrarEntrega: edita && o.estado === "COMPRANDO" && !!o.compra && (!o.entrega || o.entrega.parcial),
      cancelar: edita && aberto, aceiteFora: edita && o.estado === "ESCOLHIDA" && !esc?.aceiteEm,
    },
  };
}

function comparacaoJson(e: EstadoOrcamentos, x: ContextoOrcamentos, o: OrcamentoFalso) {
  const propostas = o.convites.map((c, i) => ({ c, i, p: emUso(c) })).filter((y): y is { c: ConviteFalso; i: number; p: PropostaFalsa } => !!y.p && y.c.estado !== "REVOGADO")
    .map(({ c, i, p }) => {
      const pdf = p.pdfId ? o.arquivos.find((a) => a.id === p.pdfId) : null;
      return { conviteId: c.id, propostaId: p.id, letra: letra(i), nome: c.nome, origem: c.prestadorId ? "PRESTADOR" : "LINK", numero: p.numero, versoes: c.propostas.length,
        total: total(p), valor: p.valor, frete: p.frete, freteIncluso: p.freteIncluso, marcaModelo: p.marcaModelo, prazoExecucao: p.prazoExecucao, garantia: p.garantia,
        inclui: p.inclui, naoInclui: p.naoInclui, faltaAlgo: !!p.faltaAlgo, validaAte: p.validaAte, vencida: vencida(p), confirmada: !!p.confirmadaEm, confirmacaoPedidaEm: p.confirmacaoPedidaEm,
        pagamento: p.pagamento, pdf: pdf ? { id: pdf.id, nome: pdf.nome } : null,
        anteriores: c.propostas.filter((q) => !q.emUso).map((q) => ({ numero: q.numero, total: total(q), validaAte: q.validaAte, enviadaEm: q.enviadaEm })) };
    });
  const menor = [...propostas].sort((a, b) => a.total - b.total)[0];
  const r = regraDe(e, o, x.alcada());
  return { propostas, menorTotal: menor?.conviteId ?? null, minimo: { pedido: r.faixa?.minimo ?? 1, recebidas: propostas.length, atendido: r.minimoAtendido },
    alcadaConselho: x.alcada(), faixa: r.faixa, pode: { decidir: x.pode("orcamentos.decidir") && (o.estado === "COMPARANDO" || (o.estado === "PEDINDO" && prazoFechou(o))) } };
}

const mensagem = (x: ContextoOrcamentos, condominio: string, o: OrcamentoFalso, codigo: string) =>
  `Olá, aqui é ${x.eu.nome}, ${x.sindico ? "síndica" : "da gestão"} do ${condominio}. Queremos um orçamento para ${o.titulo.charAt(0).toLowerCase()}${o.titulo.slice(1)}. ` +
  `Veja o que precisa e mande sua proposta até ${diaDe(o.prazoPropostas).slice(8, 10)}/${diaDe(o.prazoPropostas).slice(5, 7)}, por este link: /o/${codigo}. Se não puder participar, é só dizer no link.`;

function linkDe(x: ContextoOrcamentos, o: OrcamentoFalso, c: ConviteFalso) {
  return { conviteId: c.id, nome: c.nome, canal: c.canal, envio: c.canal === "EMAIL" ? "EMAIL" : "COPIAR", ...(c.canal === "EMAIL" ? {} : { codigo: c.codigo }),
    mensagem: mensagem(x, "Residencial Ipê", o, c.codigo), celular: c.celular };
}

function novoConvite(e: EstadoOrcamentos, o: OrcamentoFalso, d: Record<string, unknown>): ConviteFalso | string {
  const prestador = d.prestadorId ? e.prestadores.find((p) => p.id === d.prestadorId) : null;
  if (d.prestadorId && !prestador) return "prestadorId";
  const nome = prestador ? prestador.nome : String(d.nome ?? "").trim();
  if (nome.length < 2) return "nome";
  const canal = prestador ? prestador.canal : d.canal === "EMAIL" ? "EMAIL" : "WHATSAPP";
  const celular = prestador ? prestador.celular : String(d.celular ?? "").replace(/\D/g, "") || null;
  const email = prestador ? prestador.email : String(d.email ?? "").trim() || null;
  if (!prestador && canal === "WHATSAPP" && !celular) return "celular";
  if (!prestador && canal === "EMAIL" && !email) return "email";
  return convite({ prestadorId: prestador?.id ?? null, nome, celular, email, canal, codigo: `link-${novoId().slice(-6)}`, expiraEm: o.prazoPropostas });
}

export async function rotasOrcamentos(route: Route, e: EstadoOrcamentos, x: ContextoOrcamentos, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL): Promise<void | null> {
  if (!caminho.startsWith("/v1/condominio/orcamentos") && caminho !== "/v1/condominio/regras-orcamento") return null;
  const anota = () => e.enviados.push({ caminho: `${metodo} ${caminho}`, corpo });
  const texto = (k: string) => String(corpo[k] ?? "").trim();
  const hist = (o: OrcamentoFalso, t: string, tom = "violeta") => o.historico.unshift({ em: AGORA, texto: t, tom });

  if (caminho === "/v1/condominio/regras-orcamento") {
    if (!x.pode("config.ver")) return erro(route, 403, "FORBIDDEN");
    if (metodo === "GET") return route.fulfill({ json: { ...e.regras, alcadaConselho: x.alcada(), pode: { editar: x.pode("config.editar") } } });
    if (!x.pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    anota();
    if (corpo.versao !== e.regras.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: e.regras.versao });
    const faixas = (corpo.faixas as RegrasFalsas["faixas"]) ?? [];
    if (corpo.ligada === true && !faixas.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ["faixas"] });
    for (let i = 1; i < faixas.length; i++) {
      const a = faixas[i - 1]!.ate, b = faixas[i]!.ate;
      if (a === null || (b !== null && b <= a)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["faixas"] });
    }
    e.regras = { versao: e.regras.versao + 1, ligada: corpo.ligada === true, faixas, abaixoMinimo: corpo.abaixoMinimo === "BLOQUEIA" ? "BLOQUEIA" : "MOTIVO",
      prazoDias: Number(corpo.prazoDias), validadeDias: Number(corpo.validadeDias), linkDias: Number(corpo.linkDias) };
    return route.fulfill({ json: { versao: e.regras.versao } });
  }

  if (!x.pode("orcamentos.ver")) return erro(route, 403, "FORBIDDEN");
  const edita = x.pode("orcamentos.editar");

  if (caminho === "/v1/condominio/orcamentos" && metodo === "GET") {
    const filtro = url.searchParams.get("filtro") ?? "EM_ANDAMENTO";
    const DO_FILTRO: Record<string, (o: OrcamentoFalso) => boolean> = {
      EM_ANDAMENTO: (o) => ABERTO.includes(o.estado) || o.estado === "RASCUNHO", DECIDIDOS: (o) => ["ESCOLHIDA", "COMPRANDO"].includes(o.estado),
      ENCERRADOS: (o) => o.estado === "ENTREGUE", CANCELADOS: (o) => o.estado === "CANCELADO",
    };
    if (!DO_FILTRO[filtro]) return erro(route, 400, "VALIDATION_ERROR", { campos: ["filtro"] });
    const r = resumoOrcamentos(e);
    return route.fulfill({ json: { hoje: HOJE, pode: { criar: edita }, contagens: { pedindo: r.pedindo, comparar: r.comparar,
      decidir: e.orcamentos.filter((o) => o.estado === "COMPARANDO").length, comprando: e.orcamentos.filter((o) => ["ESCOLHIDA", "COMPRANDO"].includes(o.estado)).length },
      orcamentos: e.orcamentos.filter(DO_FILTRO[filtro]!).map((o) => listaJson(e, o)) } });
  }
  if (caminho === "/v1/condominio/orcamentos/opcoes") {
    return route.fulfill({ json: { prestadores: e.prestadores.map((p) => ({ id: p.id, nome: p.nome, servico: p.servico, canal: p.canal, servicosFeitos: p.servicosFeitos })),
      manutencoes: x.manutencoes(), pedidos: x.pedidos(), locais: ["Casa de bombas", "Hall da Torre A", "Garagem"],
      regras: { ligada: e.regras.ligada, faixas: e.regras.faixas, abaixoMinimo: e.regras.abaixoMinimo, prazoDias: e.regras.prazoDias, validadeDias: e.regras.validadeDias, linkDias: e.regras.linkDias, alcadaConselho: x.alcada() },
      conselho: x.conselho() } });
  }
  if (caminho === "/v1/condominio/orcamentos" && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    anota();
    if (texto("titulo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
    if (texto("descricao").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["descricao"] });
    if (corpo.tipo && corpo.tipo !== "SERVICO") return erro(route, 400, "VALIDATION_ERROR", { campos: ["tipo"] });
    const prazo = texto("prazoPropostas");
    if (!prazo || prazo <= AGORA) return erro(route, 400, "VALIDATION_ERROR", { campos: ["prazoPropostas"] });
    const mandar = corpo.mandar !== false;
    const lista = (corpo.convites as Record<string, unknown>[] | undefined) ?? [];
    if (mandar && !lista.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ["convites"] });
    const manut = corpo.manutencaoId ? x.manutencoes().find((m) => m.id === corpo.manutencaoId) : null;
    if (corpo.manutencaoId && !manut) return erro(route, 400, "VALIDATION_ERROR", { campos: ["manutencaoId"] });
    const o = orcamento({ titulo: texto("titulo"), descricao: texto("descricao"), local: texto("local") || null, manutencaoId: manut?.id ?? null, manutencaoTitulo: manut?.titulo ?? null,
      pedidoId: (corpo.pedidoId as string) || null, pedidoTexto: corpo.pedidoId ? x.pedidos().find((p) => p.id === corpo.pedidoId)?.titulo ?? null : null,
      valorEstimado: typeof corpo.valorEstimado === "number" ? corpo.valorEstimado : null, prazoPropostas: prazo, validadeMinimaDias: Number(corpo.validadeMinimaDias) || e.regras.validadeDias,
      criadoEm: AGORA, estado: mandar ? "PEDINDO" : "RASCUNHO", cuidador: x.eu.nome });
    for (const d of lista) {
      const c = novoConvite(e, o, d);
      if (typeof c === "string") return erro(route, 400, "VALIDATION_ERROR", { campos: ["convites", c] });
      o.convites.push(c);
    }
    e.orcamentos.unshift(o);
    hist(o, mandar ? `${x.eu.nome.split(" ")[0]} criou o orçamento e mandou ${o.convites.length === 1 ? "1 convite" : `${o.convites.length} convites`}` : "Orçamento criado");
    return route.fulfill({ status: 201, json: { id: o.id, versao: o.versao, links: mandar ? o.convites.map((c) => linkDe(x, o, c)) : [] } });
  }

  const anexo = /^\/v1\/condominio\/orcamentos\/anexos\/([^/]+)\/(verificar|link|tirar)$/.exec(caminho);
  if (anexo) {
    const o = e.orcamentos.find((y) => y.arquivos.some((a) => a.id === anexo[1]));
    const a = o?.arquivos.find((y) => y.id === anexo[1]);
    if (!o || !a) return erro(route, 404, "NOT_FOUND");
    if (anexo[2] === "verificar") { a.situacao = "LIBERADO"; return route.fulfill({ json: { situacao: "LIBERADO" } }); }
    if (anexo[2] === "link") return route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, nome: a.nome, tipo: a.tipo } });
    o.arquivos = o.arquivos.filter((y) => y !== a);
    return route.fulfill({ json: { ok: true } });
  }

  const r = /^\/v1\/condominio\/orcamentos\/([^/]+)(?:\/([a-z-]+))?(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(caminho);
  if (!r) return erro(route, 404, "NOT_FOUND");
  const o = e.orcamentos.find((y) => y.id === r[1]);
  if (!o) return erro(route, 404, "NOT_FOUND");
  const acao = r[2];
  if (!acao && metodo === "GET") return route.fulfill({ json: detalheJson(e, x, o) });
  if (acao === "comparacao") return route.fulfill({ json: comparacaoJson(e, x, o) });
  anota();
  if (!acao && metodo === "PUT") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== o.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: o.versao });
    if (texto("titulo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
    if (texto("descricao").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["descricao"] });
    Object.assign(o, { titulo: texto("titulo"), descricao: texto("descricao"), local: texto("local") || null, valorEstimado: typeof corpo.valorEstimado === "number" ? corpo.valorEstimado : null, versao: o.versao + 1 });
    if (recebidas(o)) { o.editadoEm = AGORA; hist(o, "O pedido foi alterado. Quem já respondeu foi avisado no link"); } else hist(o, "O pedido foi alterado");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "anexos" && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(corpo.tipo))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO" });
    const a: ArquivoFalso = { id: novoId(), nome: String(corpo.nome), tipo: String(corpo.tipo), tamanho: Number(corpo.tamanho), situacao: "ENVIANDO", conviteId: null, propostaId: null };
    o.arquivos.push(a);
    return route.fulfill({ status: 201, json: { arquivoId: a.id, envio: { url: `/api/v1/armazenamento/${a.id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  if (acao === "convites" && !r[3] && metodo === "POST") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const lista = (corpo.convites as Record<string, unknown>[] | undefined) ?? [];
    if (!lista.length) return erro(route, 400, "VALIDATION_ERROR", { campos: ["convites"] });
    const novos: ConviteFalso[] = [];
    for (const d of lista) {
      const c = novoConvite(e, o, d);
      if (typeof c === "string") return erro(route, 400, "VALIDATION_ERROR", { campos: ["convites", c] });
      novos.push(c);
    }
    o.convites.push(...novos);
    if (o.estado === "RASCUNHO") o.estado = "PEDINDO";
    for (const c of novos) hist(o, `${c.nome} foi convidado`);
    o.versao++;
    return route.fulfill({ json: { links: novos.map((c) => linkDe(x, o, c)) } });
  }
  if (acao === "convites" && r[3]) {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const c = o.convites.find((y) => y.id === r[3]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (r[4] === "reenviar") {
      if (c.estado === "RECUSOU") return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONVITE_RECUSADO" });
      c.codigosAntigos.push(c.codigo);
      c.codigo = `link-${novoId().slice(-6)}`;
      c.expiraEm = o.prazoPropostas;
      if (c.estado === "REVOGADO") { c.estado = c.propostas.length ? "RESPONDEU" : "CONVIDADO"; c.revogado = null; }
      c.versao++;
      hist(o, `Link mandado de novo para ${c.nome}`);
      return route.fulfill({ json: { link: linkDe(x, o, c) } });
    }
    if (r[4] === "revogar") {
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      c.estado = "REVOGADO"; c.revogado = { em: AGORA, motivo: texto("motivo") }; c.versao++;
      hist(o, `Link de ${c.nome} revogado`, "neutro");
      return route.fulfill({ json: { versao: c.versao } });
    }
    if (r[4] === "pedir-confirmacao") {
      const p = emUso(c);
      if (!p || !vencida(p)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_NAO_VENCIDA" });
      p.confirmacaoPedidaEm = AGORA;
      hist(o, `Pedida a confirmação do preço a ${c.nome}`);
      return route.fulfill({ json: { ok: true } });
    }
    return erro(route, 404, "NOT_FOUND");
  }
  if (acao === "estender") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    const prazo = texto("prazoPropostas");
    if (!prazo || prazo <= AGORA || prazo <= o.prazoPropostas) return erro(route, 400, "VALIDATION_ERROR", { campos: ["prazoPropostas"] });
    o.prazoPropostas = prazo; o.fechadoEm = null; o.estado = "PEDINDO"; o.versao++;
    for (const c of o.convites) if (c.estado !== "REVOGADO") c.expiraEm = prazo;
    hist(o, "Prazo estendido");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "fechar") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    o.fechadoEm = AGORA; o.estado = "COMPARANDO"; o.versao++;
    hist(o, `Prazo fechou com ${recebidas(o) === 1 ? "1 proposta" : `${recebidas(o)} propostas`}`);
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "escolher") {
    if (!x.pode("orcamentos.decidir")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== undefined && corpo.versao !== o.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: o.versao });
    const c = o.convites.find((y) => y.propostas.some((p) => p.id === corpo.propostaId && p.emUso));
    const p = c?.propostas.find((q) => q.id === corpo.propostaId);
    if (!c || !p) return erro(route, 400, "VALIDATION_ERROR", { campos: ["propostaId"] });
    if (vencida(p)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_VENCIDA" });
    const comp = comparacaoJson(e, x, o);
    const menor = comp.propostas.find((y) => y.conviteId === comp.menorTotal);
    const motivo = texto("motivo");
    if (!comp.minimo.atendido && e.regras.abaixoMinimo === "BLOQUEIA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ABAIXO_DO_MINIMO" });
    if ((menor && total(p) > menor.total) || !comp.minimo.atendido) { if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] }); }
    const quem = corpo.quemAprova === "CONSELHO" ? "CONSELHO" : "PESSOA";
    const despesaId = quem === "CONSELHO" ? x.criarDespesa(o, total(p), c.nome) : null;
    o.escolha = { propostaId: p.id, conviteId: c.id, motivo: motivo || null, em: AGORA, por: x.eu.nome, quemAprova: quem, despesaId, despesaEstado: despesaId ? "AGUARDANDO" : null, aprovadaEm: despesaId ? null : AGORA };
    for (const y of o.convites) y.escolhido = y.id === c.id;
    o.estado = "ESCOLHIDA"; o.versao++;
    hist(o, `Proposta de ${c.nome} escolhida`, "ok");
    if (despesaId) hist(o, "Mandada ao conselho como despesa para aprovar");
    return route.fulfill({ json: { estado: o.estado, despesaId } });
  }
  if (acao === "desfazer-escolha") {
    if (!x.pode("orcamentos.decidir") || o.estado !== "ESCOLHIDA") return erro(route, 403, "FORBIDDEN");
    o.escolha = null; o.estado = "COMPARANDO"; o.versao++;
    for (const y of o.convites) { y.escolhido = false; y.resultadoAvisadoEm = null; }
    hist(o, "Escolha desfeita", "neutro");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "aceite-fora") {
    if (!edita || o.estado !== "ESCOLHIDA" || !o.escolha) return erro(route, 403, "FORBIDDEN");
    const data = texto("data");
    if (!data || data > HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["data"] });
    const c = o.convites.find((y) => y.id === o.escolha!.conviteId)!;
    c.aceiteEm = `${data}T12:00:00.000Z`; c.aceiteForaDoLink = true; c.aceiteNome = c.nome;
    if (o.escolha.despesaId === null || o.escolha.aprovadaEm) o.estado = "COMPRANDO";
    o.versao++;
    hist(o, "Aceite registrado fora do link", "ok");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "compra") {
    if (!edita || o.estado !== "COMPRANDO") return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== o.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: o.versao });
    const data = texto("data");
    if (!data || data > HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["data"] });
    if (typeof corpo.valorFechado !== "number" || corpo.valorFechado <= 0) return erro(route, 400, "VALIDATION_ERROR", { campos: ["valorFechado"] });
    o.compra = { compradaEm: data, valorFechado: corpo.valorFechado, notaFiscalId: null }; o.versao++;
    hist(o, "Compra registrada", "ok");
    return route.fulfill({ json: { versao: o.versao } });
  }
  if (acao === "entrega") {
    if (!edita || o.estado !== "COMPRANDO" || !o.compra) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== o.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: o.versao });
    const data = texto("data");
    if (!data || data > HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["data"] });
    const parcial = corpo.parcial === true;
    o.entrega = { entregueEm: data, parcial, observacao: texto("observacao") || null };
    if (!parcial) o.estado = "ENTREGUE";
    o.versao++;
    hist(o, parcial ? "Entrega parcial registrada" : "Entrega registrada", "ok");
    return route.fulfill({ json: { versao: o.versao, estado: o.estado } });
  }
  if (acao === "cancelar") {
    if (!edita) return erro(route, 403, "FORBIDDEN");
    if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    o.cancelado = { em: AGORA, motivo: texto("motivo") }; o.estado = "CANCELADO"; o.versao++;
    hist(o, "Orçamento cancelado", "erro");
    return route.fulfill({ json: { versao: o.versao } });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** O link do fornecedor, sem conta (/o/<código>; quadros 476 a 478). */
export async function rotasOrcamentoPublico(route: Route, e: EstadoOrcamentos, caminho: string, metodo: string, corpo: Record<string, unknown>): Promise<void | null> {
  const r = /^\/v1\/publico\/orcamento\/([^/]+)(?:\/([a-z-]+))?(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(caminho);
  if (!r) return null;
  const codigo = r[1]!;
  let o: OrcamentoFalso | undefined;
  let c: ConviteFalso | undefined;
  let trocado = false;
  for (const y of e.orcamentos) {
    for (const z of y.convites) {
      if (z.codigo === codigo) { o = y; c = z; }
      else if (z.codigosAntigos.includes(codigo)) { o = y; c = z; trocado = true; }
    }
  }
  if (!o || !c) return erro(route, 404, "NOT_FOUND");
  e.enviados.push({ caminho: `${metodo} ${caminho}`, corpo });
  const p = emUso(c);
  const base = { condominio: "Residencial Ipê", fornecedor: { nome: c.nome }, hoje: HOJE };
  const estadoLink = (): { estado: string; motivo?: string; mensagens: string[] } => {
    const p = emUso(c!);
    if (trocado) return { estado: "NAO_VALE", motivo: "LINK_TROCADO", mensagens: [] };
    if (c!.estado === "REVOGADO") return { estado: "NAO_VALE", motivo: "REVOGADO", mensagens: [] };
    if (Date.parse(c!.expiraEm) + e.regras.linkDias * DIA < Date.parse(AGORA)) return { estado: "NAO_VALE", motivo: "VENCIDO", mensagens: [] };
    if (o!.estado === "CANCELADO") return { estado: "CANCELADO", mensagens: [o!.cancelado ? `Motivo: ${o!.cancelado.motivo}` : ""].filter(Boolean) };
    if (c!.estado === "RECUSOU") return { estado: "RECUSOU", mensagens: [] };
    if (["ESCOLHIDA", "COMPRANDO", "ENTREGUE"].includes(o!.estado)) {
      if (c!.escolhido) return { estado: c!.aceiteEm ? "ACEITA" : "ESCOLHIDA", mensagens: [] };
      return { estado: "NAO_ESCOLHIDA", mensagens: [] };
    }
    if (p && vencida(p) && p.confirmacaoPedidaEm) return { estado: "CONFIRMAR_PRECO", mensagens: [] };
    if (p) return { estado: "ENVIADA", mensagens: [...(o!.editadoEm ? ["O condomínio alterou o pedido depois da sua proposta. Confira o que precisa."] : []), ...(prazoFechou(o!) ? ["O prazo para propostas acabou: a sua já está com o condomínio."] : [])] };
    if (prazoFechou(o!)) return { estado: "PRAZO_ACABOU", mensagens: [] };
    return { estado: "VER", mensagens: [] };
  };
  const json = () => {
    const s = estadoLink();
    const p = emUso(c!);
    const escondido = s.estado === "NAO_VALE";
    return { ...base, ...s,
      ...(escondido ? {} : { pedido: { titulo: o!.titulo, descricao: o!.descricao, local: o!.local, prazoPropostas: o!.prazoPropostas, validadeMinimaDias: o!.validadeMinimaDias,
        arquivos: o!.arquivos.filter((a) => !a.conviteId && a.situacao === "LIBERADO").map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo })), editadoEm: o!.editadoEm } }),
      proposta: escondido || !p ? null : propostaJson(o!, p),
      aceite: c!.aceiteEm ? { em: c!.aceiteEm, nome: c!.aceiteNome ?? c!.nome } : null };
  };
  if (!r[2] && metodo === "GET") { if (!trocado && c.estado !== "REVOGADO") c.aberturas++; return route.fulfill({ json: json() }); }
  if (r[2] === "arquivos" && r[3]) {
    const a = o.arquivos.find((y) => y.id === r[3] && (!y.conviteId || y.conviteId === c!.id));
    return a ? route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, nome: a.nome, tipo: a.tipo } }) : erro(route, 404, "NOT_FOUND");
  }
  const s = estadoLink();
  if (r[2] === "pdf" && !r[3] && metodo === "POST") {
    if (corpo.tipo !== "application/pdf") return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO" });
    const a: ArquivoFalso = { id: novoId(), nome: String(corpo.nome), tipo: "application/pdf", tamanho: Number(corpo.tamanho), situacao: "ENVIANDO", conviteId: c.id, propostaId: null };
    o.arquivos.push(a);
    return route.fulfill({ status: 201, json: { arquivoId: a.id, envio: { url: `/api/v1/armazenamento/${a.id}`, metodo: "PUT", tipo: "application/pdf" } } });
  }
  if (r[2] === "pdf" && r[3] && r[4] === "verificar") {
    const a = o.arquivos.find((y) => y.id === r[3] && y.conviteId === c!.id);
    if (!a) return erro(route, 404, "NOT_FOUND");
    a.situacao = "LIBERADO";
    return route.fulfill({ json: { situacao: "LIBERADO" } });
  }
  if (s.estado === "NAO_VALE" || s.estado === "CANCELADO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "LINK_NAO_VALE" });
  if (r[2] === "recusar") {
    if (s.estado !== "VER") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ESTADO_INVALIDO" });
    c.estado = "RECUSOU"; c.recusaMotivo = String(corpo.motivo ?? "").trim() || null; c.recusouEm = AGORA; c.versao++;
    o.historico.unshift({ em: AGORA, texto: `${c.nome} recusou o convite`, tom: "neutro" });
    return route.fulfill({ json: json() });
  }
  if (r[2] === "proposta") {
    if (!["VER", "ENVIADA", "CONFIRMAR_PRECO"].includes(s.estado) || prazoFechou(o)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PRAZO_ACABOU" });
    const campos: string[] = [];
    if (typeof corpo.valor !== "number" || corpo.valor <= 0) campos.push("valor");
    if (corpo.freteIncluso !== true && (typeof corpo.frete !== "number" || corpo.frete < 0)) campos.push("frete");
    if (String(corpo.prazoExecucao ?? "").trim().length < 1) campos.push("prazoExecucao");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(corpo.validaAte)) || String(corpo.validaAte) < HOJE) campos.push("validaAte");
    if (String(corpo.inclui ?? "").trim().length < 3) campos.push("inclui");
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    for (const q of c.propostas) q.emUso = false;
    const pdf = corpo.pdfArquivoId ? o.arquivos.find((a) => a.id === corpo.pdfArquivoId && a.conviteId === c!.id) : null;
    const nova = proposta({ numero: c.propostas.length + 1, valor: corpo.valor as number, frete: corpo.freteIncluso === true ? 0 : (corpo.frete as number), freteIncluso: corpo.freteIncluso === true,
      marcaModelo: String(corpo.marcaModelo ?? "").trim() || null, prazoExecucao: String(corpo.prazoExecucao).trim(), garantia: String(corpo.garantia ?? "").trim() || null,
      validaAte: String(corpo.validaAte), pagamento: String(corpo.pagamento ?? "").trim() || null, inclui: String(corpo.inclui).trim(), naoInclui: String(corpo.naoInclui ?? "").trim() || null,
      pdfId: pdf?.id ?? null, enviadaEm: AGORA });
    if (pdf) pdf.propostaId = nova.id;
    c.propostas.push(nova); c.estado = "RESPONDEU"; c.versao++;
    o.historico.unshift({ em: AGORA, texto: `${c.nome} mandou a proposta${nova.numero > 1 ? ` (versão ${nova.numero})` : ""}`, tom: "violeta" });
    return route.fulfill({ json: { numero: nova.numero, ...json() } });
  }
  if (r[2] === "confirmar-preco") {
    if (s.estado !== "CONFIRMAR_PRECO" || !p) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ESTADO_INVALIDO" });
    const validaAte = String(corpo.validaAte ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validaAte) || validaAte < HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["validaAte"] });
    p.validaAte = validaAte; p.confirmadaEm = AGORA;
    o.historico.unshift({ em: AGORA, texto: `${c.nome} confirmou o preço`, tom: "ok" });
    return route.fulfill({ json: json() });
  }
  if (r[2] === "aceitar") {
    if (s.estado !== "ESCOLHIDA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "ESTADO_INVALIDO" });
    const nome = String(corpo.nome ?? "").trim();
    if (nome.length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    c.aceiteEm = AGORA; c.aceiteNome = nome; c.versao++;
    if (o.escolha && (o.escolha.despesaId === null || o.escolha.aprovadaEm)) o.estado = "COMPRANDO";
    if (!c.prestadorId) { const id = novoId(); e.prestadores.push({ id, nome: c.nome, servico: o.titulo, canal: c.canal, celular: c.celular, email: c.email, servicosFeitos: 0 }); c.prestadorId = id; }
    o.historico.unshift({ em: AGORA, texto: `${c.nome} aceitou fazer o serviço`, tom: "ok" });
    return route.fulfill({ json: json() });
  }
  return erro(route, 404, "NOT_FOUND");
}

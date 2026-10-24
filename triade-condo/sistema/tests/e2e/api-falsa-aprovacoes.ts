// Parte da R5 na API falsa da Plataforma: o conselho, as regras de decisão, a ausência do síndico,
// o voto pelo painel e pelo link sem conta, e as despesas para aprovar. As regras de verdade estão
// testadas no banco (pgTAP 044) e na API (Deno); aqui só o bastante para a tela.
import type { Route } from "@playwright/test";
import { AGORA } from "./api-falsa-pedidos";
import type { Contexto, DecisaoFalsa, EstadoDecisoes, GanchosDecisoes, PedidoFalso } from "./api-falsa-decisoes";

const HORA = 3600_000;
const depois = (h: number) => new Date(Date.parse(AGORA) + h * HORA).toISOString();
const diaDe = (iso: string) => new Date(Date.parse(iso) - 3 * HORA).toISOString().slice(0, 10);
const HOJE = diaDe(AGORA);
const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 24 * HORA).toISOString().slice(0, 10);
let n = 0;
const novoId = () => `5c6d7e8f-9a0b-4c1d-8e2f-${String(++n).padStart(12, "0")}`;

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

type Papel = "SUBSINDICO" | "CONSELHEIRO" | "CONSELHEIRO_FISCAL" | "SUPLENTE";
interface Membro {
  id: string; versao: number; nome: string; papel: Papel; canal: "WHATSAPP" | "EMAIL"; celular?: string; email?: string;
  vinculo?: string; contatoId?: string; unidade?: string; inicio: string; fim: string; incluidoEm: string; retiradoEm?: string; retiradoMotivo?: string;
}
interface Voto { escolha: string; justificativa?: string; em: string; canal: "PAINEL" | "LINK" }
interface Votacao { titulares: string[]; necessarios: number; votos: Record<string, Voto> }
interface Link { codigo: string; membroId: string; tipo: "DECISAO" | "DESPESA"; itemId: string; finalidade: "VOTO" | "SUBSTITUTO" | "AVISO"; valido: boolean; abertoEm?: string }
interface Anexo { id: string; nome: string; tipo: string; parte: "DOCUMENTO" | "COMPROVANTE"; tamanho: number; situacao: string; enviadoEm: string; enviadoPor: string }
interface Despesa {
  id: string; versao: number; estado: "AGUARDANDO" | "APROVADA" | "RECUSADA" | "RETIRADA" | "PAGA"; modo: "PESSOA" | "CONSELHO";
  descricao: string; valor: number; fornecedor: { prestadorId?: string; nome: string }; vencimento?: string; prazo: string; decisorId?: string;
  pedidaEm: string; pedidaPor: string; respondidaEm?: string; respondidaPor?: string; justificativa?: string; retiradaMotivo?: string;
  voltouAoSindicoEm?: string; pagamento?: { pagaEm: string; registradaEm: string; registradaPor: string; comprovanteId?: string };
  anexos: Anexo[]; historico: { em: string; acao: string; quem?: string; dados: Record<string, unknown> }[];
}
interface Ausencia { id: string; versao: number; de: string; ate: string; motivo: string | null; encerrada: boolean }

export interface EstadoAprovacoes {
  ligado: boolean;
  regras: { versao: number; quorum: "MAIORIA" | "TODOS" | "MINIMO"; minimo: number | null; empate: "SINDICO" | "DEVOLVIDA"; vencidaAvisa: string; alcada: number | null };
  membros: Membro[];
  ausencia: Ausencia | null;
  votacoes: Record<string, Votacao>;
  links: Link[];
  despesas: Despesa[];
  anexosDecisao: Record<string, Anexo[]>;
  /** O que a tela mandou, para o teste conferir. */
  enviados: { caminho: string; corpo: Record<string, unknown> }[];
}

export function criarAprovacoes(): EstadoAprovacoes {
  return { ligado: false, regras: { versao: 1, quorum: "MAIORIA", minimo: null, empate: "SINDICO", vencidaAvisa: "NINGUEM", alcada: 300000 },
    membros: [], ausencia: null, votacoes: {}, links: [], despesas: [], anexosDecisao: {}, enviados: [] };
}

const PRESTADORES = [{ id: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b", nome: "Elevadores Planalto", servico: "Elevadores" }];

/** Com a R5 em uso: o conselho com 4 titulares em dia (a Bruna é a subsíndica, com acesso ao painel), uma suplente e um
 * membro com o mandato vencido; uma decisão do 2026-0001 em votação; uma fechada; e quatro despesas. */
export function semearAprovacoes(a: EstadoAprovacoes, decisoes: EstadoDecisoes, pedidos: PedidoFalso[], vAna: string, vBruna: string) {
  a.ligado = true;
  const m = (nome: string, papel: Papel, canal: Membro["canal"], extra: Partial<Membro> = {}): Membro => ({
    id: novoId(), versao: 1, nome, papel, canal, inicio: "2026-04-01", fim: "2028-03-31", incluidoEm: depois(-24 * 30), ...extra });
  a.membros.push(
    m("Bruna", "SUBSINDICO", "EMAIL", { vinculo: vBruna, email: "bruna@exemplo.com" }),
    m("Marta Reis", "CONSELHEIRO", "WHATSAPP", { celular: "+5561999994821", contatoId: novoId(), unidade: "Torre A · 502" }),
    m("João Pedro Alves", "CONSELHEIRO", "EMAIL", { email: "joao@exemplo.com", unidade: "Torre B · 201" }),
    m("Lúcia Andrade", "CONSELHEIRO_FISCAL", "WHATSAPP", { celular: "+5561999990303", inicio: "2024-11-15", fim: "2026-11-14", unidade: "Torre B · 303" }),
    m("Rafael Gomes", "SUPLENTE", "WHATSAPP", { celular: "+5561999990301", unidade: "Torre A · 301" }),
    m("Paulo Dias", "CONSELHEIRO", "EMAIL", { email: "paulo@exemplo.com", inicio: "2024-10-11", fim: "2026-10-10" }),
  );
  const [bruna, marta, joao, lucia, , paulo] = a.membros;
  const p1 = pedidos[0]!;
  const alternativas = [{ numero: 1, descricao: "Trocar o portão inteiro", detalhe: "Portões Brasília · garantia de 2 anos", custo: 940000, moeda: "BRL" },
    { numero: 2, descricao: "Trocar só o motor", detalhe: "Hidro Serviços · garantia de 1 ano", custo: 180000, moeda: "BRL" }];
  const pend = { id: novoId(), tipo: "DECISAO", motivo: "Trocar o portão da garagem ou consertar o motor", responsavelId: "", abertaEm: depois(-48),
    abertaPor: "Bruna", resolvidaEm: null, resolvidaPor: null, resolucao: null };
  p1.pendencias.push(pend);
  const emVotacao: DecisaoFalsa = { id: "d0e1f2a3-b4c5-4d6e-8f7a-000000000101", versao: 1, estado: "AGUARDANDO", modo: "CONSELHO", pedidoId: p1.id, pendenciaId: pend.id,
    pergunta: "Trocar o portão da garagem ou consertar o motor", porque: "O motor parou duas vezes este mês e o conserto não tem garantia.",
    prazo: somarDias(HOJE, 7), decisorId: "", pedidaEm: depois(-48), pedidaPor: "Bruna", alternativas };
  const fechada: DecisaoFalsa = { id: "d0e1f2a3-b4c5-4d6e-8f7a-000000000102", versao: 2, estado: "APROVADA", modo: "CONSELHO", pedidoId: p1.id, pendenciaId: novoId(),
    pergunta: "Pintura do hall: qual cor", prazo: somarDias(HOJE, -3), decisorId: "", pedidaEm: depois(-24 * 10), pedidaPor: "Ana Souza",
    respondidaEm: depois(-24 * 4), respondidaPor: "Conselho", alternativaAprovada: 1, justificativa: "Aprovada por 3 de 4 titulares",
    alternativas: [{ numero: 1, descricao: "Cinza claro" }, { numero: 2, descricao: "Bege" }] };
  decisoes.decisoes.push(emVotacao, fechada);
  const titulares = [bruna!.id, marta!.id, joao!.id, lucia!.id];
  a.votacoes[emVotacao.id] = { titulares, necessarios: 3, votos: {
    [marta!.id]: { escolha: "2", em: depois(-20), canal: "LINK" },
    [joao!.id]: { escolha: "DEVOLVER", justificativa: "Quero ver um terceiro orçamento antes.", em: depois(-23), canal: "LINK" } } };
  a.votacoes[fechada.id] = { titulares, necessarios: 3, votos: {
    [bruna!.id]: { escolha: "1", em: depois(-24 * 5), canal: "PAINEL" }, [marta!.id]: { escolha: "1", em: depois(-24 * 5), canal: "LINK" },
    [lucia!.id]: { escolha: "1", em: depois(-24 * 4), canal: "LINK" }, [joao!.id]: { escolha: "DEVOLVER", justificativa: "Pedir desconto antes.", em: depois(-24 * 4), canal: "LINK" } } };
  a.links.push(
    { codigo: "link-marta-voto", membroId: marta!.id, tipo: "DECISAO", itemId: emVotacao.id, finalidade: "VOTO", valido: true, abertoEm: depois(-21) },
    { codigo: "link-lucia-voto", membroId: lucia!.id, tipo: "DECISAO", itemId: emVotacao.id, finalidade: "VOTO", valido: true, abertoEm: depois(-12) },
    { codigo: "link-joao-voto", membroId: joao!.id, tipo: "DECISAO", itemId: emVotacao.id, finalidade: "VOTO", valido: true, abertoEm: depois(-24) },
    { codigo: "link-joao-fechada", membroId: joao!.id, tipo: "DECISAO", itemId: fechada.id, finalidade: "VOTO", valido: true },
    { codigo: "link-marta-trocado", membroId: marta!.id, tipo: "DECISAO", itemId: emVotacao.id, finalidade: "VOTO", valido: false },
    { codigo: "link-paulo-vencido", membroId: paulo!.id, tipo: "DECISAO", itemId: emVotacao.id, finalidade: "VOTO", valido: true },
  );

  const despesa = (d: Partial<Despesa> & Pick<Despesa, "descricao" | "valor" | "fornecedor" | "modo" | "estado">): Despesa => ({
    id: novoId(), versao: 1, prazo: somarDias(HOJE, 7), pedidaEm: depois(-30), pedidaPor: "Bruna", anexos: [],
    historico: [{ em: depois(-30), acao: "despesa.pedida", quem: "Bruna", dados: { modo: d.modo, necessarios: 3, titulares: 4 } }], ...d });
  const elevador = despesa({ descricao: "Conta de reparo do elevador", valor: 425000, fornecedor: { prestadorId: PRESTADORES[0]!.id, nome: "Elevadores Planalto" },
    vencimento: "2026-11-05", modo: "CONSELHO", estado: "AGUARDANDO",
    anexos: [{ id: novoId(), nome: "Fatura 8812 Elevadores Planalto.pdf", tipo: "application/pdf", parte: "DOCUMENTO", tamanho: 182000, situacao: "LIBERADO",
      enviadoEm: depois(-30), enviadoPor: "Bruna" }] });
  a.despesas.push(
    elevador,
    despesa({ descricao: "Compra de lâmpadas LED das garagens", valor: 68000, fornecedor: { nome: "Casa da Luz" }, vencimento: "2026-10-30", modo: "PESSOA",
      estado: "AGUARDANDO", decisorId: vAna }),
    despesa({ descricao: "Limpeza da caixa d’água", valor: 120000, fornecedor: { nome: "Hidro Serviços" }, modo: "PESSOA", estado: "PAGA", decisorId: vAna,
      respondidaEm: depois(-24 * 6), respondidaPor: "Ana Souza", justificativa: "Está no calendário de limpeza.",
      pagamento: { pagaEm: "2026-10-12", registradaEm: depois(-24 * 4), registradaPor: "Ana Souza" } }),
    despesa({ descricao: "Troca do interfone da portaria", valor: 390000, fornecedor: { nome: "Fone Fácil" }, modo: "PESSOA", estado: "RECUSADA", decisorId: vAna,
      respondidaEm: "2026-10-08T15:00:00Z", respondidaPor: "Ana Souza", justificativa: "Falta o segundo orçamento." }),
  );
  a.votacoes[elevador.id] = { titulares, necessarios: 3, votos: { [marta!.id]: { escolha: "APROVAR", em: depois(-10), canal: "LINK" } } };
}

export interface ContextoAprovacoes extends Contexto {
  decisoes: EstadoDecisoes;
  vAna: string;
  sindico: string;
}

const emDia = (m: Membro) => !m.retiradoEm && m.inicio <= HOJE && m.fim >= HOJE;
const titular = (m: Membro) => m.papel !== "SUPLENTE";
const ativos = (a: EstadoAprovacoes) => a.membros.filter((m) => !m.retiradoEm);
const titularesEmDia = (a: EstadoAprovacoes) => ativos(a).filter((m) => titular(m) && emDia(m));
function necessarios(a: EstadoAprovacoes, n = titularesEmDia(a).length): number | null {
  if (n < 1) return null;
  if (a.regras.quorum === "MAIORIA") return Math.floor(n / 2) + 1;
  if (a.regras.quorum === "TODOS") return n;
  return a.regras.minimo && a.regras.minimo <= n ? a.regras.minimo : null;
}
function regrasResumo(a: EstadoAprovacoes) {
  const nec = necessarios(a);
  return { quorum: a.regras.quorum, ...(a.regras.minimo ? { minimo: a.regras.minimo } : {}), empate: a.regras.empate, vencidaAvisa: a.regras.vencidaAvisa,
    ...(a.regras.alcada ? { alcada: a.regras.alcada } : {}), titularesEmDia: titularesEmDia(a).length, podePedir: nec !== null, ...(nec ? { necessarios: nec } : {}) };
}
const subsindico = (a: EstadoAprovacoes) => ativos(a).find((m) => m.papel === "SUBSINDICO");
const ausenciaAtiva = (a: EstadoAprovacoes) => (a.ausencia && !a.ausencia.encerrada && a.ausencia.ate >= HOJE ? a.ausencia : null);
function ausenciaJson(a: EstadoAprovacoes, sindico: string) {
  const x = ausenciaAtiva(a);
  const s = subsindico(a);
  return x ? { id: x.id, versao: x.versao, de: x.de, ate: x.ate, ativa: x.de <= HOJE, motivo: x.motivo, sindico, substituto: s?.nome ?? "", substitutoId: s?.id ?? "" } : null;
}
const mascara = (cel?: string) => (cel ? `(${cel.slice(3, 5)}) 9•••• ${cel.slice(-4)}` : undefined);
const mascaraEmail = (e?: string) => (e ? `${e.slice(0, 3)}•••@${e.split("@")[1]}` : undefined);

function membroJson(m: Membro, gerencia: boolean) {
  const vencendo = emDia(m) && Date.parse(`${m.fim}T12:00:00Z`) - Date.parse(`${HOJE}T12:00:00Z`) <= 30 * 24 * HORA;
  return { id: m.id, versao: m.versao, nome: m.nome, papel: m.papel, titular: titular(m), vota: titular(m), emDia: emDia(m), mandatoInicio: m.inicio, mandatoFim: m.fim,
    mandatoVencendo: vencendo, canal: m.canal, painel: !!m.vinculo, ...(m.vinculo ? { pessoaId: m.vinculo } : {}), ...(m.contatoId ? { contatoId: m.contatoId } : {}),
    ...(m.unidade ? { unidade: m.unidade } : {}), ...(gerencia ? { celular: m.celular, email: m.email } : {}),
    celularMascarado: mascara(m.celular), emailMascarado: mascaraEmail(m.email), incluidoEm: m.incluidoEm,
    ...(m.retiradoEm ? { retiradoEm: m.retiradoEm, retiradoMotivo: m.retiradoMotivo } : {}) };
}

/** Quem está entrando, se for do conselho. */
const euMembro = (a: EstadoAprovacoes, x: Contexto) => ativos(a).find((m) => m.vinculo === x.eu.vinculo);

function contagem(v: Votacao) {
  const c: Record<string, number> = {};
  for (const voto of Object.values(v.votos)) c[voto.escolha] = (c[voto.escolha] ?? 0) + 1;
  return c;
}

function votacaoJson(a: EstadoAprovacoes, v: Votacao, x: Contexto, gestao: boolean, aberta: boolean) {
  const eu = euMembro(a, x);
  const ver = gestao || !aberta;
  const membros = v.titulares.map((id) => a.membros.find((m) => m.id === id)!);
  const votos = membros.filter((m) => ver || m.id === eu?.id).map((m) => {
    const voto = v.votos[m.id];
    const link = [...a.links].reverse().find((l) => l.membroId === m.id && l.valido && v === a.votacoes[l.itemId]);
    return { membroId: m.id, nome: m.nome, papel: m.papel, emDia: emDia(m), ...(m.id === eu?.id ? { eu: true } : {}),
      ...(voto ? { escolha: voto.escolha, ...(voto.justificativa ? { justificativa: voto.justificativa } : {}), votadoEm: voto.em, canal: voto.canal } : {}),
      ...(link || m.vinculo ? { link: { canal: m.canal, envio: m.canal === "WHATSAPP" ? "COPIAR" : "ENVIADO", ...(link?.abertoEm ? { abertoEm: link.abertoEm } : {}) } } : {}) };
  });
  const meu = eu ? v.votos[eu.id] : undefined;
  return { titulares: v.titulares.length, necessarios: v.necessarios, votaram: Object.keys(v.votos).length,
    ...(ver ? { contagem: contagem(v) } : {}), ...(gestao ? { faltam: membros.filter((m) => !v.votos[m.id] && emDia(m)).map((m) => m.nome) } : {}), votos,
    ...(eu && v.titulares.includes(eu.id) ? { eu: { membroId: eu.id, ...(meu ? { escolha: meu.escolha, justificativa: meu.justificativa, votadoEm: meu.em } : {}),
      podeVotar: aberta && emDia(eu) } } : {}) };
}

/** Novo link para o membro: o anterior do mesmo item para de valer. */
function novoLink(a: EstadoAprovacoes, m: Membro, tipo: Link["tipo"], itemId: string) {
  for (const l of a.links) if (l.membroId === m.id && l.itemId === itemId) l.valido = false;
  const codigo = `link-${novoId()}`;
  a.links.push({ codigo, membroId: m.id, tipo, itemId, finalidade: "VOTO", valido: true });
  return { membroId: m.id, nome: m.nome, canal: m.canal, envio: m.canal === "WHATSAPP" ? "COPIAR" : "EMAIL", ...(m.canal === "WHATSAPP" ? { codigo } : {}) };
}

/** Fecha a votação quando uma escolha chega ao quórum ou quando todos votaram sem chegar. */
function apurar(a: EstadoAprovacoes, x: ContextoAprovacoes, tipo: "DECISAO" | "DESPESA", id: string) {
  const v = a.votacoes[id]!;
  const c = contagem(v);
  const ganhou = Object.entries(c).find(([, k]) => k >= v.necessarios)?.[0];
  const todos = Object.keys(v.votos).length >= v.titulares.length;
  if (!ganhou && !todos) return;
  if (tipo === "DECISAO") {
    const d = x.decisoes.decisoes.find((y) => y.id === id)!;
    const p = x.pedidos.find((y) => y.id === d.pedidoId)!;
    const pend = p.pendencias.find((y) => y.id === d.pendenciaId);
    d.respondidaEm = AGORA; d.respondidaPor = "Conselho"; d.versao++;
    if (ganhou && ganhou !== "DEVOLVER") { d.estado = "APROVADA"; d.alternativaAprovada = Number(ganhou); d.justificativa = `Aprovada por ${c[ganhou]} de ${v.titulares.length} titulares`; }
    else if (ganhou) { d.estado = "DEVOLVIDA"; d.justificativa = "Devolvida pelo conselho"; }
    else if (a.regras.empate === "SINDICO") {
      d.estado = "DEVOLVIDA";
      const nova: DecisaoFalsa = { ...structuredClone(d), id: novoId(), versao: 1, estado: "AGUARDANDO", modo: "PESSOA", decisorId: x.vAna, origemId: d.id,
        respondidaEm: undefined, respondidaPor: undefined, justificativa: undefined };
      d.voltouAoSindico = nova.id;
      x.decisoes.decisoes.push(nova);
    } else d.estado = "DEVOLVIDA";
    if (pend && d.estado !== "AGUARDANDO" && !d.voltouAoSindico) { pend.resolvidaEm = AGORA; pend.resolvidaPor = "Conselho"; pend.resolucao = d.estado === "APROVADA" ? `Aprovada a alternativa ${d.alternativaAprovada}` : "Devolvida"; }
    p.historico.push({ acao: "pedido.decisao_respondida", em: AGORA, autor: null, dados: { conselho: true, aprovada: d.estado === "APROVADA", alternativa: d.alternativaAprovada,
      votos: ganhou ? c[ganhou] : undefined, titulares: v.titulares.length, ...(ganhou ? {} : { semQuorum: true, voltou: !!d.voltouAoSindico }) } });
    p.versao++;
    return;
  }
  const d = a.despesas.find((y) => y.id === id)!;
  if (ganhou) {
    d.estado = ganhou === "APROVAR" ? "APROVADA" : "RECUSADA"; d.respondidaEm = AGORA; d.respondidaPor = "Conselho"; d.versao++;
    d.justificativa = `${ganhou === "APROVAR" ? "Aprovada" : "Recusada"} por ${c[ganhou]} de ${v.titulares.length} titulares`;
    d.historico.unshift({ em: AGORA, acao: "despesa.respondida", dados: { aprovada: ganhou === "APROVAR" } });
  } else if (a.regras.empate === "SINDICO") {
    d.voltouAoSindicoEm = AGORA; d.decisorId = x.vAna; d.versao++;
    d.historico.unshift({ em: AGORA, acao: "despesa.voltou_ao_sindico", dados: {} });
  } else { d.estado = "RECUSADA"; d.respondidaEm = AGORA; d.versao++; d.historico.unshift({ em: AGORA, acao: "despesa.respondida", dados: { semQuorum: true } }); }
}

/** Os ganchos que a api-falsa-decisoes chama. */
export function ganchosAprovacoes(a: EstadoAprovacoes, x: ContextoAprovacoes): GanchosDecisoes {
  const gestao = () => x.pode("decisoes.aprovar") || x.pode("pedidos.atualizar");
  return {
    decisao: (d) => {
      const v = a.votacoes[d.id];
      const origem = d.origemId ? x.decisoes.decisoes.find((y) => y.id === d.origemId) : undefined;
      const aberta = d.estado === "AGUARDANDO";
      const eu = euMembro(a, x);
      const aus = ausenciaJson(a, x.sindico);
      return {
        ...(d.modo ? { modo: d.modo } : {}),
        ...(d.modo === "CONSELHO" ? { decisor: undefined } : {}),
        ...(v && d.modo === "CONSELHO" ? { conselho: votacaoJson(a, v, x, gestao(), aberta) } : {}),
        ...(origem && a.votacoes[origem.id] ? { origem: { id: origem.id, conselho: votacaoJson(a, a.votacoes[origem.id]!, x, true, false) } } : {}),
        ...(d.voltouAoSindico ? { voltouAoSindico: d.voltouAoSindico } : {}),
        ...(aus?.ativa && d.decisorId === x.vAna && aberta ? { substituto: { nome: aus.substituto, ate: aus.ate } } : {}),
        ...(a.anexosDecisao[d.id]?.length ? { anexos: a.anexosDecisao[d.id] } : {}),
        ...(d.modo === "CONSELHO" ? { pode: {
          responder: false, retirar: aberta && (d.pedidaPor === x.eu.nome || x.pode("pedidos.atualizar")),
          votar: aberta && !!eu && emDia(eu) && !!v?.titulares.includes(eu.id), reenviar: aberta && gestao(), anexar: aberta && gestao() } } : {}),
      };
    },
    minhaVotacao: (d) => {
      const eu = euMembro(a, x);
      return d.modo === "CONSELHO" && !!eu && emDia(eu) && !!a.votacoes[d.id]?.titulares.includes(eu.id) && !a.votacoes[d.id]?.votos[eu.id];
    },
    pedirAoConselho: (d) => {
      const tit = titularesEmDia(a);
      if (!tit.length) return { motivo: "CONSELHO_VAZIO" };
      const nec = necessarios(a);
      if (!nec) return { motivo: "SEM_QUORUM_POSSIVEL" };
      a.votacoes[d.id] = { titulares: tit.map((m) => m.id), necessarios: nec, votos: {} };
      return { titulares: tit.length, necessarios: nec, links: tit.filter((m) => !m.vinculo).map((m) => novoLink(a, m, "DECISAO", d.id)) };
    },
    lista: () => ({ conselho: regrasResumo(a), ausencia: ausenciaJson(a, x.sindico), despesasAguardando: despesasDe(a, x).length,
      pode: { aprovar: x.pode("decisoes.aprovar"), despesas: x.pode("despesas.ver") || despesasDe(a, x).length > 0 } }),
    regras: () => regrasResumo(a),
  };
}

/** As despesas que esperam a pessoa: a que ela aprova ou a votação em que ela vota. */
function despesasDe(a: EstadoAprovacoes, x: Contexto) {
  const eu = euMembro(a, x);
  return a.despesas.filter((d) => d.estado === "AGUARDANDO" && (d.modo === "PESSOA" || d.voltouAoSindicoEm ? d.decisorId === x.eu.vinculo
    : !!eu && emDia(eu) && !!a.votacoes[d.id]?.titulares.includes(eu.id) && !a.votacoes[d.id]?.votos[eu.id]));
}

/** O resumo do Início e do menu (resumo_decisoes): votos e despesas entram em aguardando. */
export function resumoAprovacoes(a: EstadoAprovacoes, x: ContextoAprovacoes, base: { aguardando: number; vencidas: number; maisAntigaDias: number | null; votos?: number }) {
  const despesas = despesasDe(a, x).length;
  return { ...base, aguardando: base.aguardando + despesas, despesas, votos: base.votos ?? 0 };
}

function despesaJson(a: EstadoAprovacoes, d: Despesa, x: ContextoAprovacoes, ficha: boolean) {
  const v = a.votacoes[d.id];
  const gestao = x.pode("despesas.registrar");
  const aberta = d.estado === "AGUARDANDO";
  const eu = euMembro(a, x);
  const decisor = d.decisorId ? x.pessoas.find((p) => p.vinculoId === d.decisorId) : undefined;
  const conselhoAberto = d.modo === "CONSELHO" && !d.voltouAoSindicoEm;
  const aus = ausenciaJson(a, x.sindico);
  const decididaOuPaga = d.estado === "APROVADA" || d.estado === "PAGA" || d.estado === "RECUSADA";
  return {
    id: d.id, versao: d.versao, estado: d.estado, modo: d.modo, descricao: d.descricao, valor: d.valor, moeda: "BRL", fornecedor: d.fornecedor,
    ...(d.vencimento ? { vencimento: d.vencimento } : {}), prazo: d.prazo, vencida: aberta && d.prazo < HOJE,
    ...(a.regras.alcada ? { alcada: a.regras.alcada } : {}), passaAlcada: !!a.regras.alcada && d.valor >= a.regras.alcada,
    pedidaEm: d.pedidaEm, pedidaPor: d.pedidaPor,
    ...(decisor ? { decisor: { vinculoId: decisor.vinculoId, nome: decisor.nome, eu: decisor.vinculoId === x.eu.vinculo } } : {}),
    ...(v ? { conselho: votacaoJson(a, v, x, gestao, aberta && conselhoAberto) } : {}),
    ...(d.voltouAoSindicoEm ? { voltouAoSindicoEm: d.voltouAoSindicoEm } : {}),
    ...(d.respondidaEm ? { respondidaEm: d.respondidaEm, respondidaPor: d.respondidaPor } : {}),
    ...(d.justificativa ? { justificativa: d.justificativa } : {}), ...(d.retiradaMotivo ? { retiradaMotivo: d.retiradaMotivo } : {}),
    ...(d.pagamento ? { pagamento: d.pagamento } : {}),
    ...(aus?.ativa && aberta && d.decisorId === x.vAna ? { substituto: { nome: aus.substituto, ate: aus.ate } } : {}),
    anexos: ficha ? d.anexos : d.anexos.length,
    ...(ficha ? { historico: d.historico } : {}),
    ...(ficha && gestao && decididaOuPaga ? { comunicado: {
      titulo: `Despesa ${d.estado === "RECUSADA" ? "recusada" : "aprovada"}: ${d.descricao}`,
      texto: `${d.descricao}, de ${d.fornecedor.nome}, no valor combinado, foi ${d.estado === "RECUSADA" ? "recusada" : "aprovada"}. O pagamento é feito fora do sistema.` } } : {}),
    pode: {
      votar: aberta && conselhoAberto && !!eu && emDia(eu) && !!v?.titulares.includes(eu.id),
      anexar: d.estado !== "RETIRADA" && d.estado !== "RECUSADA" && gestao,
      alterar: aberta && gestao && !(v && Object.keys(v.votos).length),
      retirar: aberta && (gestao || d.pedidaPor === x.eu.nome),
      reenviar: aberta && conselhoAberto && gestao,
      responder: aberta && !conselhoAberto && (d.decisorId === x.eu.vinculo || x.eu.vinculo === x.vAna),
      pagar: d.estado === "APROVADA" && gestao,
      desfazerPagamento: d.estado === "PAGA" && gestao,
    },
  };
}

const FILTRO_DESPESA: Record<string, (d: Despesa) => boolean> = {
  AGUARDANDO: (d) => d.estado === "AGUARDANDO", APROVADAS: (d) => d.estado === "APROVADA" || d.estado === "PAGA",
  RECUSADAS: (d) => d.estado === "RECUSADA", TODAS: () => true,
};

/** O link do conselheiro (sem conta): atende antes do login. */
export async function rotasConselhoPublico(route: Route, a: EstadoAprovacoes, x: ContextoAprovacoes, caminho: string, metodo: string,
  corpo: Record<string, unknown>): Promise<void | null> {
  const r = /^\/v1\/publico\/conselho\/([^/]+)(?:\/(voto|resposta|arquivos\/([^/]+)))?$/.exec(caminho);
  if (!r) return null;
  const l = a.links.find((y) => y.codigo === decodeURIComponent(r[1]!));
  if (!l || !a.ligado) return erro(route, 404, "NOT_FOUND");
  const m = a.membros.find((y) => y.id === l.membroId)!;
  const decisao = l.tipo === "DECISAO" ? x.decisoes.decisoes.find((y) => y.id === l.itemId) : undefined;
  const despesa = l.tipo === "DESPESA" ? a.despesas.find((y) => y.id === l.itemId) : undefined;
  const v = a.votacoes[l.itemId];
  const motivo = !l.valido ? "LINK_TROCADO" : m.retiradoEm ? "SAIU_DO_CONSELHO" : !emDia(m) ? "MANDATO_VENCIDO" : null;
  const item = decisao ?? despesa!;
  const fechada = item.estado !== "AGUARDANDO" || (despesa && !!despesa.voltouAoSindicoEm);
  const json = () => {
    if (motivo === "LINK_TROCADO") return { condominio: "Residencial Ipê", estado: "NAO_VALE", motivo, membro: m.nome };
    const meu = v?.votos[m.id];
    const prazo = item.prazo;
    const estado = motivo ? "NAO_VALE" : fechada ? "FECHADA" : prazo < HOJE ? "PRAZO_ACABOU" : meu ? "VOTADO" : "VOTAR";
    return {
      condominio: "Residencial Ipê", finalidade: l.finalidade, estado, ...(motivo ? { motivo } : {}), prazo, hoje: HOJE, membro: { nome: m.nome, papel: m.papel },
      item: decisao ? {
        tipo: "DECISAO", pergunta: decisao.pergunta, ...(decisao.porque ? { porque: decisao.porque } : {}), alternativas: decisao.alternativas, pedidaPor: decisao.pedidaPor,
        pedidaEm: decisao.pedidaEm, anexos: a.anexosDecisao[decisao.id] ?? [],
        ...(fechada ? { resultado: { estado: decisao.estado, ...(decisao.alternativaAprovada ? { alternativaAprovada: decisao.alternativaAprovada } : {}),
          justificativa: decisao.justificativa, voltouAoSindico: !!decisao.voltouAoSindico } } : {}),
      } : {
        tipo: "DESPESA", descricao: despesa!.descricao, valor: despesa!.valor, moeda: "BRL", fornecedor: despesa!.fornecedor.nome,
        ...(despesa!.vencimento ? { vencimento: despesa!.vencimento } : {}), pedidaPor: despesa!.pedidaPor, pedidaEm: despesa!.pedidaEm, anexos: despesa!.anexos,
        ...(fechada ? { resultado: { estado: despesa!.estado, justificativa: despesa!.justificativa, voltouAoSindico: !!despesa!.voltouAoSindicoEm } } : {}),
      },
      ...(meu ? { meuVoto: { escolha: meu.escolha, ...(meu.justificativa ? { justificativa: meu.justificativa } : {}), votadoEm: meu.em } } : {}),
      ...(v ? { conselho: { titulares: v.titulares.length, necessarios: v.necessarios, votaram: Object.keys(v.votos).length,
        votos: fechada ? v.titulares.map((id) => { const y = a.membros.find((z) => z.id === id)!; const voto = v.votos[id];
          return { membroId: id, nome: y.nome, papel: y.papel, ...(voto ? { escolha: voto.escolha, justificativa: voto.justificativa, votadoEm: voto.em, canal: voto.canal } : {}) }; }) : [] } } : {}),
    };
  };
  if (!r[2] && metodo === "GET") {
    if (!l.abertoEm) l.abertoEm = AGORA;
    return route.fulfill({ json: json() });
  }
  if (r[3]) {
    const anexo = [...(a.anexosDecisao[l.itemId] ?? []), ...(despesa?.anexos ?? [])].find((y) => y.id === r[3]);
    return anexo ? route.fulfill({ json: { url: `/api/v1/armazenamento/${anexo.id}`, nome: anexo.nome, tipo: anexo.tipo } }) : erro(route, 404, "NOT_FOUND");
  }
  if (r[2] === "voto" && metodo === "POST") {
    if (motivo) return erro(route, 400, "VALIDATION_ERROR", { motivo });
    if (fechada) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VOTACAO_FECHADA" });
    if (item.prazo < HOJE) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PRAZO_ACABOU" });
    const escolha = String(corpo.escolha ?? "");
    const just = String(corpo.justificativa ?? "").trim();
    if (!escolha) return erro(route, 400, "VALIDATION_ERROR", { campos: ["escolha"] });
    if ((escolha === "DEVOLVER" || escolha === "RECUSAR") && just.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["justificativa"] });
    v!.votos[m.id] = { escolha, ...(just ? { justificativa: just } : {}), em: AGORA, canal: "LINK" };
    apurar(a, x, l.tipo, l.itemId);
    return route.fulfill({ json: json() });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** Atende as rotas da R5 com sessão; devolve null quando a rota não é daqui. */
export async function rotasAprovacoes(route: Route, a: EstadoAprovacoes, x: ContextoAprovacoes, caminho: string, metodo: string,
  corpo: Record<string, unknown>, url: URL): Promise<void | null> {
  if (!a.ligado) return null;
  const texto = (k: string) => String(corpo[k] ?? "").trim();
  const conselhoEditar = x.pode("conselho.editar");
  const anota = () => a.enviados.push({ caminho: `${metodo} ${caminho}`, corpo });

  // O conselho (quadros 410 e 411).
  if (caminho === "/v1/condominio/conselho" && metodo === "GET") {
    if (!x.pode("conselho.ver")) return erro(route, 403, "FORBIDDEN");
    const s = subsindico(a);
    return route.fulfill({ json: {
      hoje: HOJE, pode: { gerenciar: conselhoEditar, marcarAusencia: conselhoEditar }, regras: regrasResumo(a),
      membros: ativos(a).map((m) => membroJson(m, conselhoEditar)), retirados: a.membros.filter((m) => m.retiradoEm).map((m) => membroJson(m, conselhoEditar)),
      sindico: x.sindico, ...(s ? { subsindico: { id: s.id, nome: s.nome } } : {}), ausencia: ausenciaJson(a, x.sindico),
    } });
  }
  if (caminho === "/v1/condominio/conselho/candidatos" && metodo === "GET") {
    const busca = (url.searchParams.get("busca") ?? "").toLowerCase();
    const candidatos = [
      ...x.pessoas.filter((p) => !a.membros.some((m) => m.vinculo === p.vinculoId && !m.retiradoEm))
        .map((p) => ({ id: p.vinculoId, nome: p.nome, tipo: "PESSOA", detalhe: "Pessoa com acesso ao painel" })),
      { id: "c0ffee00-0000-4000-8000-000000000001", nome: "Carlos Lima", tipo: "CONTATO", detalhe: "Torre A · 104", celularMascarado: "(61) 9•••• 1040" },
    ].filter((c) => !busca || c.nome.toLowerCase().includes(busca) || (c.detalhe ?? "").toLowerCase().includes(busca));
    return route.fulfill({ json: { candidatos } });
  }
  const conferirMembro = (papel: string, inicio: string, fim: string, canal: string, celular: string, email: string, daFicha: boolean, eu?: Membro) => {
    if (!papel) return ["papel"];
    if (!inicio) return ["mandatoInicio"];
    if (!fim || fim < inicio) return ["mandatoFim"];
    if (canal === "WHATSAPP" && !celular && !daFicha) return ["celular"];
    if (canal === "EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !daFicha) return ["email"];
    if (papel === "SUBSINDICO" && ativos(a).some((m) => m.papel === "SUBSINDICO" && m !== eu)) return "JA_HA_SUBSINDICO";
    return null;
  };
  if (caminho === "/v1/condominio/conselho" && metodo === "POST") {
    if (!conselhoEditar) return erro(route, 403, "FORBIDDEN");
    anota();
    const pessoa = corpo.pessoaId ? x.pessoas.find((p) => p.vinculoId === corpo.pessoaId) : undefined;
    const contato = corpo.contatoId === "c0ffee00-0000-4000-8000-000000000001" ? { nome: "Carlos Lima", celular: "+5561999991040", unidade: "Torre A · 104" } : undefined;
    const nome = pessoa?.nome ?? contato?.nome ?? texto("nome");
    if (nome.length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    const celular = texto("celular") ? `+55${texto("celular").replace(/\D/g, "").replace(/^55/, "")}` : contato?.celular ?? "";
    const falha = conferirMembro(texto("papel"), texto("mandatoInicio"), texto("mandatoFim"), texto("canal"), celular, texto("email"), !!contato && texto("canal") === "WHATSAPP");
    if (Array.isArray(falha)) return erro(route, 400, "VALIDATION_ERROR", { campos: falha });
    if (falha) return erro(route, 400, "VALIDATION_ERROR", { motivo: falha });
    const m: Membro = { id: novoId(), versao: 1, nome, papel: texto("papel") as Papel, canal: texto("canal") as Membro["canal"], inicio: texto("mandatoInicio"),
      fim: texto("mandatoFim"), incluidoEm: AGORA, ...(celular ? { celular } : {}), ...(texto("email") ? { email: texto("email") } : {}),
      ...(pessoa ? { vinculo: pessoa.vinculoId } : {}), ...(contato ? { contatoId: String(corpo.contatoId), unidade: contato.unidade } : {}) };
    a.membros.push(m);
    return route.fulfill({ status: 201, json: { id: m.id, versao: 1 } });
  }
  const cm = /^\/v1\/condominio\/conselho\/([^/]+)(\/retirar)?$/.exec(caminho);
  if (cm && (metodo === "PUT" || metodo === "POST")) {
    if (!conselhoEditar) return erro(route, 403, "FORBIDDEN");
    const m = a.membros.find((y) => y.id === cm[1]);
    if (!m) return erro(route, 404, "NOT_FOUND");
    anota();
    if (corpo.versao !== m.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: m.versao });
    if (m.retiradoEm) return erro(route, 400, "VALIDATION_ERROR", { motivo: "MEMBRO_RETIRADO" });
    if (cm[2]) {
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      if (m.papel === "SUBSINDICO" && ausenciaAtiva(a)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SUBSTITUTO_EM_AUSENCIA" });
      m.retiradoEm = AGORA; m.retiradoMotivo = texto("motivo"); m.versao++;
      for (const l of a.links) if (l.membroId === m.id) l.valido = l.valido && false;
      return route.fulfill({ json: { versao: m.versao } });
    }
    const celular = texto("celular") ? `+55${texto("celular").replace(/\D/g, "").replace(/^55/, "")}` : "";
    const falha = conferirMembro(texto("papel"), texto("mandatoInicio"), texto("mandatoFim"), texto("canal"), celular, texto("email"), false, m);
    if (Array.isArray(falha)) return erro(route, 400, "VALIDATION_ERROR", { campos: falha });
    if (falha) return erro(route, 400, "VALIDATION_ERROR", { motivo: falha });
    Object.assign(m, { papel: texto("papel"), inicio: texto("mandatoInicio"), fim: texto("mandatoFim"), canal: texto("canal"), celular: celular || undefined,
      email: texto("email") || undefined, versao: m.versao + 1 });
    return route.fulfill({ json: { versao: m.versao } });
  }

  // As regras (quadro 421).
  if (caminho === "/v1/condominio/regras-decisoes") {
    if (metodo === "GET") {
      const s = subsindico(a);
      return route.fulfill({ json: { ...regrasResumo(a), versao: a.regras.versao, pode: { editar: conselhoEditar }, sindico: x.sindico, ...(s ? { subsindico: s.nome } : {}) } });
    }
    if (!conselhoEditar) return erro(route, 403, "FORBIDDEN");
    anota();
    if (corpo.versao !== a.regras.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: a.regras.versao });
    if (corpo.quorum === "MINIMO" && !corpo.minimo) return erro(route, 400, "VALIDATION_ERROR", { campos: ["minimo"] });
    a.regras = { versao: a.regras.versao + 1, quorum: corpo.quorum as "MAIORIA", minimo: (corpo.minimo as number | null) ?? null, empate: corpo.empate as "SINDICO",
      vencidaAvisa: String(corpo.vencidaAvisa), alcada: (corpo.alcada as number | null) ?? null };
    return route.fulfill({ json: { versao: a.regras.versao } });
  }

  // A ausência do síndico (quadro 412).
  if (caminho === "/v1/condominio/ausencia" && metodo === "POST") {
    if (!conselhoEditar) return erro(route, 403, "FORBIDDEN");
    anota();
    if (!subsindico(a)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_SUBSINDICO" });
    if (ausenciaAtiva(a)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "JA_HA_AUSENCIA" });
    const de = texto("de");
    const ate = texto("ate");
    if (!de || de < HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["de"] });
    if (!ate || ate < de || ate > somarDias(de, 60)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["ate"] });
    a.ausencia = { id: novoId(), versao: 2, de, ate, motivo: texto("motivo") || null, encerrada: false };
    return route.fulfill({ status: 201, json: { id: a.ausencia.id, versao: 2 } });
  }
  const enc = /^\/v1\/condominio\/ausencia\/([^/]+)\/encerrar$/.exec(caminho);
  if (enc && metodo === "POST") {
    if (!conselhoEditar) return erro(route, 403, "FORBIDDEN");
    anota();
    if (!a.ausencia || a.ausencia.id !== enc[1]) return erro(route, 404, "NOT_FOUND");
    if (a.ausencia.encerrada) return erro(route, 400, "VALIDATION_ERROR", { motivo: "AUSENCIA_ENCERRADA" });
    if (corpo.versao !== a.ausencia.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: a.ausencia.versao });
    a.ausencia.encerrada = true; a.ausencia.versao++;
    return route.fulfill({ json: { versao: a.ausencia.versao } });
  }

  // Voto e Reenviar o link (decisão e despesa).
  const vr = /^\/v1\/condominio\/(decisoes|despesas)\/([^/]+)\/(voto|reenviar-link)$/.exec(caminho);
  if (vr && metodo === "POST") {
    const tipo = vr[1] === "decisoes" ? "DECISAO" : "DESPESA";
    const item = tipo === "DECISAO" ? x.decisoes.decisoes.find((y) => y.id === vr[2]) : a.despesas.find((y) => y.id === vr[2]);
    const v = a.votacoes[vr[2]!];
    if (!item || !v) return erro(route, 404, "NOT_FOUND");
    anota();
    if (item.estado !== "AGUARDANDO") return erro(route, 400, "VALIDATION_ERROR", { motivo: tipo === "DECISAO" ? "DECISAO_FECHADA" : "DESPESA_FECHADA" });
    if (vr[3] === "reenviar-link") {
      const m = a.membros.find((y) => y.id === corpo.membroId && v.titulares.includes(y.id));
      if (!m) return erro(route, 400, "VALIDATION_ERROR", { campos: ["membroId"] });
      if (!emDia(m)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "MANDATO_VENCIDO" });
      return route.fulfill({ json: novoLink(a, m, tipo, item.id) });
    }
    const eu = euMembro(a, x);
    if (!eu || !v.titulares.includes(eu.id)) return erro(route, 403, "FORBIDDEN");
    const escolha = texto("escolha");
    if (!escolha) return erro(route, 400, "VALIDATION_ERROR", { campos: ["escolha"] });
    if ((escolha === "DEVOLVER" || escolha === "RECUSAR") && texto("justificativa").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["justificativa"] });
    const trocou = !!v.votos[eu.id];
    v.votos[eu.id] = { escolha, ...(texto("justificativa") ? { justificativa: texto("justificativa") } : {}), em: AGORA, canal: "PAINEL" };
    if (tipo === "DESPESA") (item as Despesa).historico.unshift({ em: AGORA, acao: "conselho.voto", quem: eu.nome, dados: { escolha, ...(trocou ? { antes: true } : {}) } });
    apurar(a, x, tipo, item.id);
    return route.fulfill({ json: { estado: item.estado, trocou, escolha } });
  }

  // Anexos da decisão e da despesa.
  const an = /^\/v1\/condominio\/(decisoes|despesas)\/([^/]+)\/anexos$/.exec(caminho);
  if (an && metodo === "POST") {
    const lista = an[1] === "despesas" ? a.despesas.find((y) => y.id === an[2])?.anexos : (a.anexosDecisao[an[2]!] ??= []);
    if (!lista) return erro(route, 404, "NOT_FOUND");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(corpo.tipo))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "TIPO_NAO_ACEITO" });
    const id = novoId();
    lista.push({ id, nome: String(corpo.nome), tipo: String(corpo.tipo), parte: corpo.parte === "COMPROVANTE" ? "COMPROVANTE" : "DOCUMENTO", tamanho: Number(corpo.tamanho),
      situacao: "ENVIANDO", enviadoEm: AGORA, enviadoPor: x.eu.nome });
    return route.fulfill({ status: 201, json: { arquivoId: id, envio: { url: `/api/v1/armazenamento/${id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  const av = /^\/v1\/condominio\/aprovacoes\/anexos\/([^/]+)\/(verificar|link|tirar)$/.exec(caminho);
  if (av) {
    const todos = [...a.despesas.flatMap((d) => d.anexos), ...Object.values(a.anexosDecisao).flat()];
    const x2 = todos.find((y) => y.id === av[1]);
    if (!x2) return erro(route, 404, "NOT_FOUND");
    if (av[2] === "verificar") {
      x2.situacao = "LIBERADO";
      const d = a.despesas.find((y) => y.anexos.includes(x2));
      d?.historico.unshift({ em: AGORA, acao: "aprovacao.anexo_enviado", quem: x.eu.nome, dados: { arquivoNome: x2.nome } });
      return route.fulfill({ json: { situacao: "LIBERADO" } });
    }
    if (av[2] === "link") return route.fulfill({ json: { url: `/api/v1/armazenamento/${x2.id}`, nome: x2.nome, tipo: x2.tipo } });
    return route.fulfill({ json: { ok: true } });
  }

  // Despesas (quadros 418 a 420 e 423).
  if (caminho === "/v1/condominio/despesas" && metodo === "GET") {
    const filtro = url.searchParams.get("filtro") ?? "AGUARDANDO";
    if (!FILTRO_DESPESA[filtro]) return erro(route, 400, "VALIDATION_ERROR", { campos: ["filtro"] });
    const vejo = (d: Despesa) => x.pode("despesas.ver") || d.pedidaPor === x.eu.nome || despesasDe(a, x).includes(d);
    const minhas = a.despesas.filter(vejo);
    return route.fulfill({ json: {
      hoje: HOJE, filtro, alcada: a.regras.alcada, pode: { registrar: x.pode("despesas.registrar") },
      contagem: { AGUARDANDO: minhas.filter(FILTRO_DESPESA.AGUARDANDO!).length, APROVADAS: minhas.filter(FILTRO_DESPESA.APROVADAS!).length,
        RECUSADAS: minhas.filter(FILTRO_DESPESA.RECUSADAS!).length },
      aguardandoEu: despesasDe(a, x).length,
      despesas: minhas.filter(FILTRO_DESPESA[filtro]!).map((d) => despesaJson(a, d, x, false)),
    } });
  }
  if (caminho === "/v1/condominio/despesas/opcoes" && metodo === "GET") {
    return route.fulfill({ json: { hoje: HOJE, ausencia: ausenciaJson(a, x.sindico), conselho: regrasResumo(a),
      decisores: x.pessoas.filter((p) => p.funcao === "SINDICO").map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, sindico: true, eu: p.vinculoId === x.eu.vinculo })),
      prestadores: PRESTADORES } });
  }
  if (caminho === "/v1/condominio/despesas" && metodo === "POST") {
    if (!x.pode("despesas.registrar")) return erro(route, 403, "FORBIDDEN");
    anota();
    if (texto("descricao").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["descricao"] });
    if (!(Number(corpo.valor) > 0)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["valor"] });
    const prestador = PRESTADORES.find((p) => p.id === corpo.prestadorId);
    if (!prestador && texto("fornecedor").length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["fornecedor"] });
    if (!texto("prazo") || texto("prazo") < HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["prazo"] });
    const modo = corpo.modo === "CONSELHO" ? "CONSELHO" : "PESSOA";
    if (modo === "PESSOA" && !corpo.decisorId) return erro(route, 400, "VALIDATION_ERROR", { campos: ["decisorId"] });
    const d: Despesa = { id: novoId(), versao: 1, estado: "AGUARDANDO", modo, descricao: texto("descricao"), valor: Number(corpo.valor),
      fornecedor: prestador ? { prestadorId: prestador.id, nome: prestador.nome } : { nome: texto("fornecedor") }, ...(texto("vencimento") ? { vencimento: texto("vencimento") } : {}),
      prazo: texto("prazo"), ...(modo === "PESSOA" ? { decisorId: String(corpo.decisorId) } : {}), pedidaEm: AGORA, pedidaPor: x.eu.nome, anexos: [], historico: [] };
    let links: unknown[] = [];
    if (modo === "CONSELHO") {
      const tit = titularesEmDia(a);
      const nec = necessarios(a);
      if (!tit.length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONSELHO_VAZIO" });
      if (!nec) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_QUORUM_POSSIVEL" });
      a.votacoes[d.id] = { titulares: tit.map((m) => m.id), necessarios: nec, votos: {} };
      links = tit.filter((m) => !m.vinculo).map((m) => novoLink(a, m, "DESPESA", d.id));
    }
    d.historico.push({ em: AGORA, acao: "despesa.pedida", quem: x.eu.nome, dados: { modo, ...(a.votacoes[d.id] ? { titulares: a.votacoes[d.id]!.titulares.length,
      necessarios: a.votacoes[d.id]!.necessarios } : {}) } });
    a.despesas.unshift(d);
    const passa = !!a.regras.alcada && d.valor >= a.regras.alcada;
    return route.fulfill({ status: 201, json: { id: d.id, versao: 1, ...(a.regras.alcada ? { alcada: a.regras.alcada } : {}), passaAlcada: passa, ...(modo === "CONSELHO" ? { links } : {}) } });
  }
  const dp = /^\/v1\/condominio\/despesas\/([^/]+)(?:\/(responder|retirar|pagar|desfazer-pagamento))?$/.exec(caminho);
  if (dp) {
    const d = a.despesas.find((y) => y.id === dp[1]);
    if (!d) return erro(route, 404, "NOT_FOUND");
    if (!dp[2] && metodo === "GET") return route.fulfill({ json: despesaJson(a, d, x, true) });
    if (metodo !== "POST") return erro(route, 404, "NOT_FOUND");
    anota();
    if (corpo.versao !== d.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: d.versao });
    const hist = (acao: string, dados: Record<string, unknown> = {}) => d.historico.unshift({ em: AGORA, acao, quem: x.eu.nome, dados });
    if (dp[2] === "responder") {
      if (d.estado !== "AGUARDANDO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESPESA_FECHADA" });
      if (d.modo === "CONSELHO" && !d.voltouAoSindicoEm) return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESPESA_DO_CONSELHO" });
      if (texto("justificativa").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["justificativa"] });
      d.estado = corpo.aprovar === true ? "APROVADA" : "RECUSADA"; d.justificativa = texto("justificativa"); d.respondidaEm = AGORA; d.respondidaPor = x.eu.nome;
      hist("despesa.respondida", { aprovada: corpo.aprovar === true });
    } else if (dp[2] === "retirar") {
      if (d.estado !== "AGUARDANDO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESPESA_FECHADA" });
      if (texto("motivo").length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      d.estado = "RETIRADA"; d.retiradaMotivo = texto("motivo"); hist("despesa.retirada", { motivo: d.retiradaMotivo });
      for (const l of a.links) if (l.itemId === d.id) l.valido = false;
    } else if (dp[2] === "pagar") {
      if (d.estado === "PAGA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "JA_PAGA" });
      if (d.estado !== "APROVADA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESPESA_NAO_APROVADA" });
      if (!texto("pagaEm") || texto("pagaEm") > HOJE) return erro(route, 400, "VALIDATION_ERROR", { campos: ["pagaEm"] });
      if (corpo.comprovanteId && !d.anexos.some((y) => y.id === corpo.comprovanteId && y.parte === "COMPROVANTE")) return erro(route, 400, "VALIDATION_ERROR", { campos: ["comprovanteId"] });
      d.estado = "PAGA";
      d.pagamento = { pagaEm: texto("pagaEm"), registradaEm: AGORA, registradaPor: x.eu.nome, ...(corpo.comprovanteId ? { comprovanteId: String(corpo.comprovanteId) } : {}) };
      hist("despesa.paga_fora", { pagaEm: d.pagamento.pagaEm });
    } else {
      if (d.estado !== "PAGA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "NAO_PAGA" });
      d.estado = "APROVADA"; d.pagamento = undefined; hist("despesa.pagamento_desfeito");
    }
    d.versao++;
    return route.fulfill({ json: { versao: d.versao } });
  }
  return null;
}

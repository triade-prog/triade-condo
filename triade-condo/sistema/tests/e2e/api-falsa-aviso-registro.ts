// Aviso de pedido registrado (F6.4, AT-26) na API falsa da Plataforma: a prévia de Quem avisar,
// o que sai no registro e a regra do síndico. As regras de verdade (quem entra, o texto que pode
// sair, a idempotência, o e-mail e o WhatsApp) estão no banco (pgTAP 029) e na API (Deno); aqui
// só o bastante para a tela.
import type { Route } from "@playwright/test";
import type { EstadoMoradores } from "./api-falsa-moradores";
import type { EstadoManutencao } from "./api-falsa-manutencao";

type Regra = "NUNCA" | "SEM_RESPONSAVEL_OU_URGENTE" | "TODOS";
interface Pessoa { vinculoId: string; nome: string; funcao: string; responsavel: boolean; disponivel: boolean }
interface Prioridade { id: string; nome: string; nivel: number; ativa: boolean }
interface Aviso { destino: string; meio: string; nome?: string; situacao?: string; enviarApos?: string; pelaRegra?: boolean; editado?: boolean;
  emails?: number; destinatarios?: number; noMural?: boolean; em: string }

export interface EstadoAvisoRegistro {
  regra: { sindico: Regra; protocolo: boolean };
  /** Quem ligou o aviso de pedido novo também no WhatsApp (F6.3). */
  comWhatsapp: string[];
  porPedido: Map<string, { avisos: Aviso[]; prestador?: { id: string; nome: string } }>;
}

export interface ContextoAviso {
  eu: { vinculo: string; nome: string };
  pessoas: Pessoa[];
  responsavelPadrao: string | null;
  moradores: EstadoMoradores;
  manutencao: EstadoManutencao;
  prioridades: Prioridade[];
  conectado: boolean;
  podePublicar: boolean;
  condominio: string;
}

/** A síndica ligou o aviso de pedido novo no WhatsApp dela; a regra começa no padrão. */
export function criarAvisoRegistro(vAna: string): EstadoAvisoRegistro {
  return { regra: { sindico: "SEM_RESPONSAVEL_OU_URGENTE", protocolo: true }, comWhatsapp: [vAna], porPedido: new Map() };
}

const curto = (nome: string) => nome.split(" ")[0]!;
const CANAL: Record<string, string> = { TELEFONE: "por telefone", PRESENCIAL: "pessoalmente", MENSAGEM: "por mensagem", EMAIL: "por e-mail",
  OBSERVACAO: "por quem cuida do prédio" };
const mascarar = (t: string) => `+${t.slice(1, 3)} ${t.slice(3, 5)} ${t.slice(5, 6)}••••-${t.slice(-4)}`;

/** Nome, telefone (pelos 8 últimos dígitos) ou e-mail de morador no texto (decisão 9). */
function comDadoDeMorador(texto: string, m: EstadoMoradores, contatoId: string | null): boolean {
  const t = texto.toLowerCase();
  const numeros = (texto.match(/[0-9][0-9 ().+-]{6,}[0-9]/g) ?? []).map((x) => x.replace(/\D/g, "")).filter((x) => x.length >= 8);
  const quem = m.contatos.find((c) => c.id === contatoId);
  return Boolean(quem?.nome && t.includes(quem.nome.toLowerCase()))
    || m.contatos.some((c) => c.telefone && numeros.some((n) => n.includes(c.telefone!.replace(/\D/g, "").slice(-8))))
    || m.contatos.some((c) => c.email && t.includes(c.email.toLowerCase()));
}

function linhas(est: EstadoAvisoRegistro, ctx: ContextoAviso, d: Record<string, unknown>) {
  const m = ctx.moradores;
  const unidadeId = (d.unidadeId as string) || null;
  const confirmado = m.vinculos.some((v) => v.contatoId === d.contatoId && v.unidadeId === unidadeId && v.estado === "CONFIRMADO");
  const contato = confirmado ? m.contatos.find((c) => c.id === d.contatoId) : undefined;
  let resp = (d.responsavelId as string) || ctx.responsavelPadrao;
  if (!ctx.pessoas.some((p) => p.vinculoId === resp && p.responsavel && p.disponivel)) resp = null;
  const pessoa = (p: Pessoa) => ({ id: p.vinculoId, nome: p.nome, voceMesmo: p.vinculoId === ctx.eu.vinculo, whatsapp: est.comWhatsapp.includes(p.vinculoId) });
  const responsaveis = resp ? ctx.pessoas.filter((p) => p.vinculoId === resp) : ctx.pessoas.filter((p) => p.funcao === "SINDICO");
  const sindicos = ctx.pessoas.filter((p) => p.funcao === "SINDICO" && !responsaveis.includes(p));
  const nivel = ctx.prioridades.find((p) => p.id === d.prioridadeId)?.nivel ?? 0;
  const urgente = nivel >= Math.max(...ctx.prioridades.filter((p) => p.ativa).map((p) => p.nivel));
  const pelaRegra = est.regra.sindico === "TODOS" || (est.regra.sindico === "SEM_RESPONSAVEL_OU_URGENTE" && (!resp || urgente));
  const meio = !contato ? undefined : contato.telefone && ctx.conectado ? "WHATSAPP" : contato.emailSituacao === "CONFIRMADO" ? "EMAIL" : undefined;
  const privado = d.privado === true;
  return {
    contato, resp,
    quemPediu: { contatoId: contato?.id, nome: contato?.nome ?? undefined, meio, marcado: Boolean(meio) && est.regra.protocolo,
      motivo: !contato ? "SEM_CONTATO" : !meio ? "SEM_MEIO" : undefined },
    responsavel: { semResponsavel: !resp, pessoas: responsaveis.map(pessoa) },
    sindico: { pelaRegra, regra: est.regra.sindico, pessoas: sindicos.map(pessoa) },
    privado,
  };
}

function meioPrestador(r: EstadoManutencao["prestadores"][number], conectado: boolean) {
  return r.telefone && conectado ? "WHATSAPP" as const : r.email ? "EMAIL" as const : undefined;
}

function rascunhoPrestador(d: Record<string, unknown>, eu: string) {
  const descricao = String(d.descricao ?? "").trim();
  return `${String(d.local ?? "").trim() || "Numa unidade do condomínio"}: ${String(d.assunto ?? "").trim()}.${descricao ? `\n\n${descricao}` : ""}\n\nPara combinar, fale com ${curto(eu)}, do condomínio.`;
}

function rascunhoMoradores(d: Record<string, unknown>) {
  const assunto = String(d.assunto ?? "").trim();
  const local = String(d.local ?? "").trim();
  return { titulo: assunto || "Aviso do condomínio", texto: `${assunto}${local ? ` (${local})` : ""}. O condomínio já sabe e está cuidando. Avisaremos quando for resolvido.` };
}

const nomeUnidade = (m: EstadoMoradores, id: string | null) => {
  const u = m.unidades.find((x) => x.id === id);
  return u ? [m.blocos.find((b) => b.id === u.blocoId)?.nome, u.identificacao].filter(Boolean).join(" · ") : null;
};

/** O bloco Quem avisar, como plataforma_quem_avisar. */
export function previaQuemAvisar(est: EstadoAvisoRegistro, ctx: ContextoAviso, d: Record<string, unknown>) {
  const m = ctx.moradores;
  const l = linhas(est, ctx, d);
  const unidade = m.unidades.find((u) => u.id === d.unidadeId);
  const prioridade = ctx.prioridades.find((p) => p.id === d.prioridadeId)?.nome.toLowerCase() ?? "prioridade";
  const escolhido = ctx.manutencao.prestadores.find((r) => r.id === d.prestadorId && !r.arquivado);
  const mensagem = l.quemPediu.meio
    ? `Olá, ${curto(l.quemPediu.nome ?? "")}. Registramos seu pedido [nº do protocolo] (${nomeUnidade(m, unidade?.id ?? null) ?? (String(d.local ?? "") || "área comum")}): `
      + `${String(d.assunto ?? "").trim() || "[assunto]"}.\n\nChegou ${CANAL[String(d.canal)] ?? "ao condomínio"}. Para acompanhar, responda aqui com 2 · Ver meus pedidos.\n\n`
      + "O que acontece agora: o condomínio confere os pedidos em dias úteis, das 8h às 18h e dá notícia por aqui. Em emergência, ligue 193.\n\n"
      + "O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem."
    : undefined;
  return {
    quemPediu: { ...l.quemPediu, mensagem },
    responsavel: l.responsavel,
    sindico: l.sindico,
    prestador: {
      disponivel: !l.privado, motivo: l.privado ? "PRIVADO" : undefined,
      escolhido: escolhido ? { id: escolhido.id, nome: escolhido.nome, meio: meioPrestador(escolhido, ctx.conectado) } : undefined,
      rascunho: rascunhoPrestador(d, ctx.eu.nome),
      cabecalho: `${ctx.condominio} · pedido [nº do protocolo] (${prioridade})`,
      rodape: "O condomínio nunca pede pagamento por mensagem.",
      textoComDadoDeMorador: "textoPrestador" in d ? comDadoDeMorador(String(d.textoPrestador), m, l.contato?.id ?? null) : undefined,
    },
    moradores: {
      disponivel: !l.privado && ctx.podePublicar, motivo: l.privado ? "PRIVADO" : !ctx.podePublicar ? "SEM_PERMISSAO" : undefined,
      rascunho: rascunhoMoradores(d),
      publico: unidade?.blocoId ? "BLOCOS" : "TODOS",
      blocos: unidade ? [unidade.blocoId].filter(Boolean) : undefined,
      textoComDadoDeMorador: "textoMoradores" in d ? comDadoDeMorador(String(d.textoMoradores), m, l.contato?.id ?? null) : undefined,
    },
    prestadores: ctx.manutencao.prestadores.filter((r) => !r.arquivado).sort((a, b) => a.nome.localeCompare(b.nome)).map((r) => {
      const meio = meioPrestador(r, ctx.conectado);
      return { id: r.id, nome: r.nome, servico: r.servico, acordo: r.acordo, contratoAte: r.contratoAte ?? undefined,
        reserva: ctx.manutencao.prestadores.find((x) => x.id === r.reservaId)?.nome, meio,
        para: meio === "WHATSAPP" ? mascarar(r.telefone!) : meio === "EMAIL" ? r.email! : undefined, temCelular: Boolean(r.telefone), temEmail: Boolean(r.email) };
    }),
    blocos: m.blocos.filter((b) => b.ativo).map((b) => ({ id: b.id, nome: b.nome, unidades: m.unidades.filter((u) => u.ativa && u.blocoId === b.id).length })),
    totalUnidades: m.unidades.filter((u) => u.ativa).length,
    condominio: ctx.condominio,
    regra: est.regra,
  };
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** O que sai no registro, como avisar_registro: devolve a recusa ou os avisos, que ficam no pedido. */
export function avisarNoRegistro(est: EstadoAvisoRegistro, ctx: ContextoAviso, pedido: { id: string; protocolo: string }, d: Record<string, unknown>, agora: string):
  { recusa: string } | { avisos: Aviso[] } {
  const m = ctx.moradores;
  const a = (d.avisar ?? {}) as { quemPediu?: boolean; sindico?: boolean; prestador?: { id: string; texto: string } | null;
    moradores?: { publico: string; blocos: string[]; unidades: string[]; titulo: string; texto: string } | null };
  const l = linhas(est, ctx, d);
  const avisos: Aviso[] = [];
  let prestador: { id: string; nome: string } | undefined;
  if (a.prestador && comDadoDeMorador(a.prestador.texto, m, l.contato?.id ?? null)) return { recusa: "DADO_DE_MORADOR" };
  if (a.moradores && comDadoDeMorador(`${a.moradores.titulo} ${a.moradores.texto}`, m, l.contato?.id ?? null)) return { recusa: "DADO_DE_MORADOR" };
  if ((a.quemPediu ?? l.quemPediu.marcado) && l.quemPediu.meio) {
    avisos.push({ destino: "QUEM_PEDIU", meio: l.quemPediu.meio, nome: l.quemPediu.nome, situacao: "NA_FILA", em: agora });
  }
  const pessoa = (destino: string, x: { nome: string; voceMesmo: boolean; whatsapp: boolean }, pelaRegra?: boolean) => {
    if (x.voceMesmo) return;
    avisos.push({ destino, meio: "SINO", nome: x.nome, situacao: "NO_SINO", pelaRegra, em: agora });
    // Fora do horário de funcionamento, o WhatsApp de quem atende espera; o sino já avisou.
    if (x.whatsapp) avisos.push({ destino, meio: "WHATSAPP", nome: x.nome, situacao: "NA_FILA", enviarApos: "2026-10-17T11:00:00.000Z", pelaRegra, em: agora });
  };
  for (const x of l.responsavel.pessoas) pessoa("RESPONSAVEL", x);
  if (l.sindico.pelaRegra || a.sindico) for (const x of l.sindico.pessoas) pessoa("SINDICO", x, l.sindico.pelaRegra || undefined);
  if (a.prestador) {
    const r = ctx.manutencao.prestadores.find((x) => x.id === a.prestador!.id)!;
    prestador = { id: r.id, nome: r.nome };
    avisos.push({ destino: "PRESTADOR", meio: meioPrestador(r, ctx.conectado)!, nome: r.nome, situacao: "NA_FILA",
      editado: a.prestador.texto !== rascunhoPrestador(d, ctx.eu.nome) || undefined, em: agora });
  }
  if (a.moradores) {
    const unidades = a.moradores.publico === "TODOS" ? m.unidades.filter((u) => u.ativa).map((u) => u.id)
      : a.moradores.publico === "BLOCOS" ? m.unidades.filter((u) => u.blocoId && a.moradores!.blocos.includes(u.blocoId)).map((u) => u.id) : a.moradores.unidades;
    const vinculos = m.vinculos.filter((v) => unidades.includes(v.unidadeId) && v.estado === "CONFIRMADO" && v.recebeComunicados);
    const nome = a.moradores.publico === "TODOS" ? "Todos os moradores"
      : a.moradores.publico === "BLOCOS" ? m.blocos.filter((b) => a.moradores!.blocos.includes(b.id)).map((b) => b.nome).join(", ")
        : `${unidades.length} ${unidades.length === 1 ? "unidade" : "unidades"}`;
    const rascunho = rascunhoMoradores(d);
    avisos.push({ destino: "MORADORES", meio: "COMUNICADO", nome, situacao: "PUBLICADO", destinatarios: vinculos.length, noMural: a.moradores.publico === "TODOS",
      emails: vinculos.filter((v) => m.contatos.find((c) => c.id === v.contatoId)?.emailSituacao === "CONFIRMADO").length,
      editado: a.moradores.titulo !== rascunho.titulo || a.moradores.texto !== rascunho.texto || undefined, em: agora });
  }
  est.porPedido.set(pedido.id, { avisos, prestador });
  return { avisos };
}

/** A regra do síndico e o protocolo (Configurações › Prazos e avisos). */
export function rotasAvisoRegistro(route: Route, est: EstadoAvisoRegistro, ctx: ContextoAviso, caminho: string, metodo: string,
  corpo: Record<string, unknown>, pode: (a: string) => boolean, sindica: boolean) {
  if (caminho === "/v1/condominio/pedidos/quem-avisar" && metodo === "POST") {
    if (!pode("pedidos.atualizar")) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: previaQuemAvisar(est, ctx, corpo) });
  }
  if (caminho === "/v1/condominio/regras-aviso-novo" && metodo === "PUT") {
    if (!pode("config.editar") || !sindica) return erro(route, 403, "FORBIDDEN");
    est.regra = { sindico: corpo.sindico as Regra, protocolo: corpo.protocolo === true };
    return route.fulfill({ json: { versao: Number(corpo.versao) + 1 } });
  }
  return null;
}

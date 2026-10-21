// Parte de moradores e unidades da API falsa da Plataforma (passos 3 e 3b). As regras de
// verdade estão testadas no banco (pgTAP 009 e 012) e na API (Deno); aqui só o bastante para a
// tela. O vínculo guarda as marcações; a relação de antes é calculada delas, como no banco.
// Garagens e veículos (F3.8; MU-06, MU-11): vagas, veículos e a busca da lista de unidades, com a
// placa achada com ou sem hífen (pgTAP 028).
import type { Route } from "@playwright/test";

interface Bloco { id: string; nome: string; ordem: number; ativo: boolean; versao: number }
interface Unidade {
  id: string; blocoId: string | null; andar: string | null; identificacao: string; ativa: boolean; versao: number;
  /** MU-11: desde quando está à venda e para alugar. */
  aVendaDesde?: string | null; paraAlugarDesde?: string | null;
}
interface Contato {
  id: string; nome: string | null; telefone: string | null; versao: number;
  /** E-mail do contato (CD-13). */
  email?: string; emailSituacao?: "PENDENTE" | "CONFIRMADO" | "DEVOLVIDO" | "PAROU"; emailComunicados?: boolean;
  /** Comunicados pelo WhatsApp (F6.6): a escolha do próprio morador. */
  comunicadosWhatsapp?: "ACEITOU" | "RECUSOU" | "PAROU"; comunicadosWhatsappEm?: string; comunicadosWhatsappOrigem?: "PERGUNTA" | "COMANDO";
}
interface Vaga { id: string; identificacao: string; onde: string | null; coberta: boolean | null; unidadeId: string | null; ativa: boolean; versao: number }
interface Veiculo {
  id: string; placa: string; tipo: "CARRO" | "MOTO" | "OUTRO"; modelo: string | null; unidadeId: string; contatoId: string | null; vagaId: string | null;
  retirado: boolean; versao: number;
}
const placaLimpa = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const placaValida = (p: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);
const mostrarPlaca = (p: string) => (/^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p);

interface Marcas { proprietario: boolean; principal: boolean; mora: boolean; ligacao: string | null; parentesco: string | null; ocupaDesde: string | null }
interface Vinculo extends Marcas {
  id: string; contatoId: string; unidadeId: string; relacao: string; recebeComunicados: boolean;
  estado: "PENDENTE" | "CONFIRMADO" | "ENCERRADO"; origem: "PAINEL" | "PLANILHA"; criadoEm: string; versao: number;
  motivo?: string; dataSaida?: string | null; encerradoEm?: string;
}

const MARCAS_DA_RELACAO: Record<string, Pick<Marcas, "proprietario" | "mora" | "ligacao">> = {
  PROPRIETARIO: { proprietario: true, mora: true, ligacao: null },
  INQUILINO: { proprietario: false, mora: true, ligacao: "INQUILINO" },
  MORADOR: { proprietario: false, mora: true, ligacao: "OUTRO" },
  FAMILIAR: { proprietario: false, mora: true, ligacao: "FAMILIAR" },
  OUTRO: { proprietario: false, mora: false, ligacao: "OUTRO" },
};

function relacaoDe(m: Pick<Marcas, "proprietario" | "mora" | "ligacao">): string {
  return m.proprietario ? "PROPRIETARIO" : m.ligacao === "INQUILINO" || m.ligacao === "FAMILIAR" ? m.ligacao : m.mora ? "MORADOR" : "OUTRO";
}

/** Marcações vindas da tela, com as regras do banco: devolve o campo errado, se houver. */
function lerMarcas(c: Record<string, unknown>): Marcas | string {
  const m: Marcas = { proprietario: c.proprietario === true, principal: c.principal === true, mora: c.mora === true,
    ligacao: (c.ligacao as string) ?? null, parentesco: (c.parentesco as string) ?? null, ocupaDesde: (c.ocupaDesde as string) ?? null };
  if (m.proprietario === !!m.ligacao) return "ligacao";
  if (m.parentesco && m.ligacao !== "FAMILIAR") return "parentesco";
  return m;
}

let n = 0;
const novoId = () => `8b9c0d1e-2f3a-4b4c-9d5e-${String(++n).padStart(12, "0")}`;

export const A101 = "8b9c0d1e-2f3a-4b4c-9d5e-a00000000101";
export const A102 = "8b9c0d1e-2f3a-4b4c-9d5e-a00000000102";

function chave(t: string): string {
  const s = t.trim();
  return (/^\D*/.exec(s)?.[0] ?? "").toLowerCase() + (/\d{1,12}/.exec(s)?.[0] ?? "").padStart(12, "0") + s.toLowerCase();
}

function chaveAndar(a: string | null): string {
  if (!a) return "";
  const n = /\d{1,6}/.exec(a)?.[0];
  if (/^t[eé]rreo/i.test(a)) return "1";
  return n ? `2${n.padStart(6, "0")}` : `3${a.toLowerCase()}`;
}

function normalizar(t: unknown): string | null {
  const v = String(t ?? "");
  const d = v.replace(/\D/g, "");
  const e = !v.trim().startsWith("+") && (d.length === 10 || d.length === 11) ? `+55${d}` : `+${d}`;
  return /^\+[1-9]\d{9,14}$/.test(e) ? e : null;
}

export function criarMoradores() {
  const torreA: Bloco = { id: novoId(), nome: "Torre A", ordem: 1, ativo: true, versao: 1 };
  const torreB: Bloco = { id: novoId(), nome: "Torre B", ordem: 2, ativo: true, versao: 1 };
  const u = (id: string, blocoId: string | null, identificacao: string): Unidade => ({ id, blocoId, andar: null, identificacao, ativa: true, versao: 1 });
  const unidades = [u(A101, torreA.id, "101"), u(A102, torreA.id, "102"), u(novoId(), torreA.id, "1001"), u(novoId(), torreA.id, "201"), u(novoId(), null, "Loja 2")];
  const ct = (nome: string, telefone: string): Contato => ({ id: novoId(), nome, telefone, versao: 1 });
  const marina: Contato = { ...ct("Marina Souza", "+5561999990001"), email: "marina@exemplo.com.br", emailSituacao: "CONFIRMADO" };
  Object.assign(marina, { comunicadosWhatsapp: "ACEITOU", comunicadosWhatsappEm: "2026-10-20T22:40:00Z", comunicadosWhatsappOrigem: "PERGUNTA" });
  const pedro: Contato = { ...ct("Pedro Souza", "+5561999990002"), comunicadosWhatsapp: "ACEITOU", comunicadosWhatsappEm: "2026-10-20T23:15:00Z",
    comunicadosWhatsappOrigem: "COMANDO" };
  const joana: Contato = { ...ct("Joana Lima", "+5561988887777"), comunicadosWhatsapp: "RECUSOU", comunicadosWhatsappEm: "2026-10-20T21:00:00Z",
    comunicadosWhatsappOrigem: "PERGUNTA" };
  const paulo = ct("Paulo Lima", "+5561988887777");
  const v = (contato: Contato, unidadeId: string, relacao: string, estado: "PENDENTE" | "CONFIRMADO", principal = false, origem: "PAINEL" | "PLANILHA" = "PAINEL",
    ocupaDesde: string | null = null): Vinculo =>
    ({ id: novoId(), contatoId: contato.id, unidadeId, relacao, ...MARCAS_DA_RELACAO[relacao]!, principal, parentesco: null, ocupaDesde, recebeComunicados: true, estado, origem,
      criadoEm: "2026-10-16T15:00:00Z", versao: 1 });
  return {
    estrutura: { agrupamento: "TORRE", usaAndar: false, versao: 1 },
    blocos: [torreA, torreB],
    unidades,
    contatos: [marina, pedro, joana, paulo],
    vinculos: [v(marina, A101, "PROPRIETARIO", "CONFIRMADO", true), v(pedro, A101, "FAMILIAR", "CONFIRMADO"), v(joana, A102, "INQUILINO", "CONFIRMADO", true, "PAINEL", "2025-03-01"),
      v(paulo, A102, "FAMILIAR", "PENDENTE", false, "PLANILHA")],
    importacoes: [] as unknown[],
    vagas: [
      { id: novoId(), identificacao: "G-23", onde: "Subsolo 1", coberta: true, unidadeId: A101, ativa: true, versao: 1 },
      { id: novoId(), identificacao: "G-24", onde: "Subsolo 1", coberta: true, unidadeId: A101, ativa: true, versao: 1 },
      { id: novoId(), identificacao: "V-01", onde: "Térreo", coberta: false, unidadeId: null, ativa: true, versao: 1 },
    ] as Vaga[],
    veiculos: [] as Veiculo[],
    /** Configurações › WhatsApp › Comunicados pelo WhatsApp (F6.6): começa desligado. */
    zap: { ligado: false, conectado: true, numero: "5561981244000", versao: 1, mudadoEm: null as string | null, mudadoPor: null as string | null },
  };
}

/** Recebe comunicado pelo WhatsApp: só quem aceitou, com os comunicados por lá ligados. */
export const recebeNoWhatsapp = (c: { comunicadosWhatsapp?: string }) => c.comunicadosWhatsapp === "ACEITOU";

export type EstadoMoradores = ReturnType<typeof criarMoradores>;

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function resumoMoradores(m: EstadoMoradores) {
  const ativas = m.unidades.filter((x) => x.ativa);
  return {
    unidades: ativas.length,
    semContato: ativas.filter((x) => !m.vinculos.some((v) => v.unidadeId === x.id && v.estado === "CONFIRMADO")).length,
    aConfirmar: m.vinculos.filter((v) => v.estado === "PENDENTE").length,
    semProprietario: ativas.filter((x) => faltaDono(m, x.id)).length,
  };
}

/** Inquilino ativo e nenhum proprietário ativo na unidade (MU-01). */
function faltaDono(m: EstadoMoradores, unidadeId: string): boolean {
  const ativos = m.vinculos.filter((v) => v.unidadeId === unidadeId && v.estado !== "ENCERRADO");
  return ativos.some((v) => v.relacao === "INQUILINO") && !ativos.some((v) => v.proprietario);
}

/** Ocupação da unidade, igual a ocupacao_unidade() no banco. */
function ocupacao(ativos: Vinculo[]): string {
  if (!ativos.length) return "SEM_CADASTRO";
  if (ativos.some((v) => v.proprietario && v.mora)) return "PROPRIETARIO_MORA";
  if (ativos.some((v) => v.mora && v.ligacao === "INQUILINO")) return "ALUGADA";
  return ativos.some((v) => v.mora) ? "CEDIDA" : "VAZIA";
}
const naoMora = (ativos: Vinculo[]) => ativos.some((v) => v.proprietario) && !ativos.some((v) => v.proprietario && v.mora);
const semResponsavel = (ativos: Vinculo[]) => ativos.length > 0 && !ativos.some((v) => v.principal);

/** Atende as rotas do passo 3; devolve null quando a rota não é daqui. */
export async function rotasMoradores(route: Route, m: EstadoMoradores, caminho: string, metodo: string, corpo: Record<string, unknown>, pode: (a: string) => boolean) {
  if (!/^\/v1\/condominio\/(unidades|blocos|moradores|contatos|vinculos-unidade|importacoes|estrutura|busca-unidades|garagens|vagas|veiculos)/.test(caminho)) return null;
  if (!pode("moradores.ver")) return erro(route, 403, "FORBIDDEN");
  const edita = pode("moradores.editar");
  const confirma = pode("moradores.confirmar");
  if (metodo !== "GET" && !edita && !caminho.endsWith("/confirmar")) return erro(route, 403, "FORBIDDEN");
  const conflito = (item: { versao: number }, versao: unknown) => (versao !== item.versao ? erro(route, 409, "VERSION_CONFLICT", { versao: item.versao, atual: item }) : null);
  const ativos = (unidadeId: string) => m.vinculos.filter((v) => v.unidadeId === unidadeId && v.estado !== "ENCERRADO");
  const contato = (id: string) => m.contatos.find((c) => c.id === id)!;
  const unidade = (id: string) => m.unidades.find((x) => x.id === id);
  const nomeUnidade = (x: Unidade) => [m.blocos.find((b) => b.id === x.blocoId)?.nome, x.andar ? (/^\d+$/.test(x.andar) ? `${x.andar}º andar` : x.andar) : null,
    x.identificacao].filter(Boolean).join(" · ");
  const mesma = (x: Unidade, blocoId: unknown, andar: unknown, ident: string) =>
    x.ativa && x.blocoId === (blocoId ?? null) && (x.andar ?? "").toLowerCase() === String(andar ?? "").toLowerCase() && x.identificacao.toLowerCase() === ident.toLowerCase();
  const compartilhado = (c: Contato) => m.contatos.some((o) => o.id !== c.id && o.telefone === c.telefone && m.vinculos.some((v) => v.contatoId === o.id && v.estado !== "ENCERRADO"));
  const nomeDaVaga = (id: string | null) => m.vagas.find((g) => g.id === id)?.identificacao;
  const vagaJson = (g: Vaga) => ({ ...g, onde: g.onde ?? undefined, coberta: g.coberta ?? undefined, unidadeId: g.unidadeId ?? undefined,
    unidade: g.unidadeId ? nomeUnidade(unidade(g.unidadeId)!) : undefined,
    veiculos: m.veiculos.filter((v) => v.vagaId === g.id && !v.retirado).map((v) => ({ id: v.id, placa: mostrarPlaca(v.placa), tipo: v.tipo, modelo: v.modelo ?? undefined })) });
  const veiculoJson = (v: Veiculo) => ({ id: v.id, placa: mostrarPlaca(v.placa), tipo: v.tipo, modelo: v.modelo ?? undefined, unidadeId: v.unidadeId,
    contatoId: v.contatoId ?? undefined, contato: v.contatoId ? contato(v.contatoId).nome ?? undefined : undefined,
    vagaId: v.vagaId ?? undefined, vaga: nomeDaVaga(v.vagaId), versao: v.versao });
  const ligar = (contatoId: string, unidadeId: string, marcas: Marcas, recebe: boolean, origem: "PAINEL" | "PLANILHA" = "PAINEL") => {
    if (marcas.principal) for (const v of ativos(unidadeId)) v.principal = false;
    const v: Vinculo = { id: novoId(), contatoId, unidadeId, relacao: relacaoDe(marcas), ...marcas, recebeComunicados: recebe,
      estado: origem === "PAINEL" && confirma ? "CONFIRMADO" : "PENDENTE", origem, criadoEm: "2026-10-16T16:00:00Z", versao: 1 };
    m.vinculos.push(v);
    return v;
  };

  if (caminho === "/v1/condominio/busca-unidades") {
    const q = (new URL(route.request().url()).searchParams.get("busca") ?? "").trim();
    if (q.length < 2 || q.length > 60) return erro(route, 400, "VALIDATION_ERROR", { campos: ["busca"] });
    const placa = placaLimpa(q);
    const digitos = q.replace(/\D/g, "");
    const achados = new Map<string, { unidadeId: string; tipo: string; texto: string }>();
    const achar = (unidadeId: string, tipo: string, texto: string) => { if (!achados.has(unidadeId)) achados.set(unidadeId, { unidadeId, tipo, texto }); };
    for (const x of m.unidades.filter((u) => u.ativa && nomeUnidade(u).toLowerCase().includes(q.toLowerCase()))) achar(x.id, "UNIDADE", nomeUnidade(x));
    if (placa.length >= 3) {
      for (const v of m.veiculos.filter((v) => !v.retirado && v.placa.includes(placa))) {
        achar(v.unidadeId, "PLACA", `placa ${mostrarPlaca(v.placa)}${v.modelo ? ` · ${v.modelo}` : ""} · ${nomeDaVaga(v.vagaId) ? `vaga ${nomeDaVaga(v.vagaId)}` : "sem vaga"}`);
      }
    }
    for (const v of m.vinculos.filter((v) => v.estado !== "ENCERRADO")) {
      const c = contato(v.contatoId);
      if (c.nome?.toLowerCase().includes(q.toLowerCase())) achar(v.unidadeId, "NOME", c.nome);
      else if (digitos.length >= 4 && c.telefone?.replace(/\D/g, "").includes(digitos)) achar(v.unidadeId, "TELEFONE", c.nome ?? "");
    }
    return route.fulfill({ json: [...achados.values()] });
  }
  if (caminho === "/v1/condominio/garagens") {
    const ativas = m.vagas.filter((g) => g.ativa);
    const emUso = m.veiculos.filter((v) => !v.retirado);
    return route.fulfill({ json: {
      vagas: [...m.vagas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || chave(a.identificacao).localeCompare(chave(b.identificacao))).map(vagaJson),
      resumo: { vagas: ativas.length, deUnidades: ativas.filter((g) => g.unidadeId).length, doCondominio: ativas.filter((g) => !g.unidadeId).length,
        veiculos: emUso.length, semVaga: emUso.filter((v) => !v.vagaId).length },
      unidades: m.unidades.filter((x) => x.ativa).map((x) => ({ id: x.id, nome: nomeUnidade(x) })),
      podeEditar: edita,
    } });
  }
  const vg = /^\/v1\/condominio\/vagas(?:\/([^/]+))?$/.exec(caminho);
  if (vg) {
    const g = vg[1] ? m.vagas.find((x) => x.id === vg[1]) : undefined;
    if (vg[1] && !g) return erro(route, 404, "NOT_FOUND");
    if (g) { const c = conflito(g, corpo.versao); if (c) return c; }
    const ident = String(corpo.identificacao ?? "").trim();
    if (!ident || ident.length > 20 || m.vagas.some((x) => x.ativa && x.id !== g?.id && x.identificacao.toLowerCase() === ident.toLowerCase())) {
      return erro(route, 400, "VALIDATION_ERROR", { campos: ["identificacao"] });
    }
    if (g && corpo.ativa === false && m.veiculos.some((v) => v.vagaId === g.id && !v.retirado)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VAGA_COM_VEICULO" });
    const dados = { identificacao: ident, onde: String(corpo.onde ?? "").trim() || null, coberta: (corpo.coberta as boolean | null) ?? null,
      unidadeId: (corpo.unidadeId as string | null) ?? null };
    if (g) {
      Object.assign(g, dados, { ativa: (corpo.ativa as boolean | null) ?? g.ativa, versao: g.versao + 1 });
      return route.fulfill({ json: { id: g.id, versao: g.versao } });
    }
    const nova: Vaga = { id: novoId(), ...dados, ativa: true, versao: 1 };
    m.vagas.push(nova);
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }
  const vc = /^\/v1\/condominio\/veiculos(?:\/([^/]+))?(\/retirar)?$/.exec(caminho);
  if (vc) {
    const v = vc[1] ? m.veiculos.find((x) => x.id === vc[1]) : undefined;
    if (vc[1] && !v) return erro(route, 404, "NOT_FOUND");
    if (v) { const c = conflito(v, corpo.versao); if (c) return c; }
    if (v?.retirado) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VEICULO_RETIRADO" });
    if (vc[2] && v) {
      Object.assign(v, { retirado: true, vagaId: null, versao: v.versao + 1 });
      return route.fulfill({ json: { versao: v.versao } });
    }
    const placa = placaLimpa(corpo.placa);
    const unidadeId = String(corpo.unidadeId ?? v?.unidadeId ?? "");
    if (!placaValida(placa) || m.veiculos.some((x) => !x.retirado && x.id !== v?.id && x.placa === placa && x.unidadeId !== unidadeId)) {
      return erro(route, 400, "VALIDATION_ERROR", { campos: ["placa"] });
    }
    const vagaId = (corpo.vagaId as string | null) ?? null;
    if (vagaId && m.vagas.find((g) => g.id === vagaId)?.unidadeId !== unidadeId) return erro(route, 400, "VALIDATION_ERROR", { campos: ["vagaId"] });
    const dados = { placa, tipo: corpo.tipo as Veiculo["tipo"], modelo: String(corpo.modelo ?? "").trim() || null, unidadeId,
      contatoId: (corpo.contatoId as string | null) ?? null, vagaId };
    if (v) {
      Object.assign(v, dados, { versao: v.versao + 1 });
      return route.fulfill({ json: { id: v.id, versao: v.versao } });
    }
    const novo: Veiculo = { id: novoId(), ...dados, retirado: false, versao: 1 };
    m.veiculos.push(novo);
    return route.fulfill({ status: 201, json: { id: novo.id, versao: 1 } });
  }
  if (caminho === "/v1/condominio/unidades" && metodo === "GET") {
    const ordemBloco = (id: string | null) => (id ? m.blocos.find((b) => b.id === id)!.ordem : 0);
    const lista = [...m.unidades].sort((a, b) => Number(b.ativa) - Number(a.ativa) || ordemBloco(a.blocoId) - ordemBloco(b.blocoId)
      || chaveAndar(a.andar).localeCompare(chaveAndar(b.andar)) || chave(a.identificacao).localeCompare(chave(b.identificacao)));
    return route.fulfill({ json: {
      estrutura: m.estrutura,
      blocos: m.blocos,
      unidades: lista.map(({ aVendaDesde, paraAlugarDesde, ...x }) => ({ ...x, aVenda: Boolean(aVendaDesde), paraAlugar: Boolean(paraAlugarDesde),
        confirmados: ativos(x.id).filter((v) => v.estado === "CONFIRMADO").length,
        pendentes: ativos(x.id).filter((v) => v.estado === "PENDENTE").length,
        temProprietario: ativos(x.id).some((v) => v.proprietario),
        semProprietario: x.ativa && faltaDono(m, x.id),
        principal: (() => { const p = ativos(x.id).find((v) => v.principal); return p ? contato(p.contatoId).nome : null; })(),
        principalRelacao: ativos(x.id).find((v) => v.principal)?.relacao ?? null,
        ocupacao: ocupacao(ativos(x.id)),
        proprietario: (() => { const p = ativos(x.id).find((v) => v.proprietario); return p ? contato(p.contatoId).nome : null; })(),
        proprietarioNaoMora: naoMora(ativos(x.id)),
        semResponsavel: x.ativa && semResponsavel(ativos(x.id)) })),
      resumo: resumoMoradores(m),
      ocupacao: ((as) => ({
        comMorador: as.filter((x) => ["PROPRIETARIO_MORA", "ALUGADA", "CEDIDA"].includes(ocupacao(ativos(x.id)))).length,
        alugadas: as.filter((x) => ocupacao(ativos(x.id)) === "ALUGADA").length,
        proprietarioNaoMora: as.filter((x) => naoMora(ativos(x.id))).length,
        semResponsavel: as.filter((x) => semResponsavel(ativos(x.id))).length,
        aVenda: as.filter((x) => x.aVendaDesde).length,
        paraAlugar: as.filter((x) => x.paraAlugarDesde).length,
      }))(m.unidades.filter((x) => x.ativa)),
      podeEditar: edita, podeConfirmar: confirma,
    } });
  }
  const un = /^\/v1\/condominio\/unidades\/([^/]+)(?:\/(contatos|mudanca|situacao))?$/.exec(caminho);
  if (un) {
    const x = unidade(un[1]!);
    if (!x) return erro(route, 404, "NOT_FOUND");
    if (!un[2] && metodo === "GET") {
      return route.fulfill({ json: {
        unidade: { ...x, bloco: m.blocos.find((b) => b.id === x.blocoId)?.nome ?? null, aVendaDesde: x.aVendaDesde ?? null, paraAlugarDesde: x.paraAlugarDesde ?? null },
        contatos: ativos(x.id).sort((a, b) => Number(a.estado === "PENDENTE") - Number(b.estado === "PENDENTE") || Number(b.principal) - Number(a.principal)).map((v) => {
          const c = contato(v.contatoId);
          return { vinculoId: v.id, contatoId: c.id, nome: c.nome, telefone: c.telefone, contatoVersao: c.versao, relacao: v.relacao, principal: v.principal,
            proprietario: v.proprietario, mora: v.mora, ligacao: v.ligacao, parentesco: v.parentesco, ocupaDesde: v.ocupaDesde,
            recebeComunicados: v.recebeComunicados, estado: v.estado, origem: v.origem, desde: v.criadoEm, versao: v.versao, telefoneCompartilhado: compartilhado(c),
            outrasUnidades: m.vinculos.filter((o) => o.contatoId === c.id && o.unidadeId !== x.id && o.estado !== "ENCERRADO").map((o) => nomeUnidade(unidade(o.unidadeId)!)),
            email: c.email, emailSituacao: c.emailSituacao, emailComunicados: c.emailComunicados ?? true,
            comunicadosWhatsapp: c.comunicadosWhatsapp ?? "SEM_RESPOSTA", comunicadosWhatsappEm: c.comunicadosWhatsappEm,
            comunicadosWhatsappOrigem: c.comunicadosWhatsapp === "PAROU" ? undefined : c.comunicadosWhatsappOrigem };
        }),
        anteriores: m.vinculos.filter((v) => v.unidadeId === x.id && v.estado === "ENCERRADO").map((v) => {
          const c = contato(v.contatoId);
          return { vinculoId: v.id, contatoId: c.id, nome: c.nome, relacao: v.relacao, motivo: v.motivo, dataSaida: v.dataSaida ?? null, encerradoEm: v.encerradoEm,
            proprietario: v.proprietario, mora: v.mora, ligacao: v.ligacao, parentesco: v.parentesco, ocupaDesde: v.ocupaDesde,
            dadosRemovidos: c.nome === null, contatoVersao: c.versao, semVinculoAtivo: !m.vinculos.some((o) => o.contatoId === c.id && o.estado !== "ENCERRADO") };
        }),
        ocupacao: { situacao: ocupacao(ativos(x.id)), moram: ativos(x.id).filter((v) => v.mora).length, proprietarioNaoMora: naoMora(ativos(x.id)) },
        faltaProprietario: faltaDono(m, x.id),
        podeEditar: edita, podeConfirmar: confirma, comunicadosWhatsappLigado: m.zap.ligado,
        vagas: m.vagas.filter((g) => g.unidadeId === x.id && g.ativa).map(vagaJson),
        veiculos: m.veiculos.filter((v) => v.unidadeId === x.id && !v.retirado).map(veiculoJson),
      } });
    }
    if (!un[2] && metodo === "PUT") {
      const c = conflito(x, corpo.versao); if (c) return c;
      if (x.ativa && corpo.ativa === false && ativos(x.id).length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "UNIDADE_COM_CONTATOS" });
      Object.assign(x, { identificacao: String(corpo.identificacao).trim(), blocoId: corpo.blocoId ?? null, andar: corpo.andar ?? null, ativa: corpo.ativa ?? x.ativa,
        versao: x.versao + 1 });
      return route.fulfill({ json: { versao: x.versao } });
    }
    if (un[2] === "situacao" && metodo === "POST") {
      if (!edita) return erro(route, 403, "FORBIDDEN");
      const c = conflito(x, corpo.versao); if (c) return c;
      const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      x.aVendaDesde = corpo.aVenda ? x.aVendaDesde ?? hoje : null;
      x.paraAlugarDesde = corpo.paraAlugar ? x.paraAlugarDesde ?? hoje : null;
      x.versao += 1;
      return route.fulfill({ json: { versao: x.versao } });
    }
    if (un[2] === "contatos") {
      let id = corpo.contatoId as string | undefined;
      if (!id) {
        const tel = normalizar(corpo.telefone);
        if (!tel) return erro(route, 400, "VALIDATION_ERROR", { campos: ["telefone"] });
        if (!String(corpo.nome ?? "").trim()) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
        const novo = { id: novoId(), nome: String(corpo.nome).trim(), telefone: tel, versao: 1 };
        m.contatos.push(novo);
        id = novo.id;
      }
      const marcas = lerMarcas((corpo.marcas ?? {}) as Record<string, unknown>);
      if (typeof marcas === "string") return erro(route, 400, "VALIDATION_ERROR", { campos: [marcas] });
      if (ativos(x.id).some((v) => v.contatoId === id)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONTATO_JA_NA_UNIDADE" });
      const pedeDono = relacaoDe(marcas) === "INQUILINO" && !ativos(x.id).some((v) => v.proprietario);
      const p = corpo.proprietario as { contatoId?: string; nome?: string; telefone?: string } | undefined;
      let dono: string | null = null;
      if (pedeDono) {
        if (!p) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FALTA_PROPRIETARIO" });
        if (p.contatoId) dono = p.contatoId;
        else {
          const tel = normalizar(p.telefone);
          if (!tel || !String(p.nome ?? "").trim()) return erro(route, 400, "VALIDATION_ERROR", { campos: ["proprietario"] });
          const novo = { id: novoId(), nome: String(p.nome).trim(), telefone: tel, versao: 1 };
          m.contatos.push(novo);
          dono = novo.id;
        }
      }
      const v = ligar(id, x.id, marcas, corpo.recebeComunicados !== false);
      if (dono) ligar(dono, x.id, { proprietario: true, principal: false, mora: false, ligacao: null, parentesco: null, ocupaDesde: null }, false);
      return route.fulfill({ status: 201, json: { vinculoId: v.id, contatoId: id, proprietarioId: dono, avisos: compartilhado(contato(id)) ? ["TELEFONE_COMPARTILHADO"] : [] } });
    }
    if (un[2] === "mudanca") {
      const saem = corpo.saem as { id: string; versao: number }[];
      const entram = (corpo.entram as (Record<string, unknown> & { nome: string; telefone: string; recebeComunicados: boolean })[])
        .map((e) => ({ ...e, marcas: lerMarcas({ ...e, ocupaDesde: corpo.data }) }));
      if (!saem.length && !entram.length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "MUDANCA_VAZIA" });
      if (entram.some((e) => !normalizar(e.telefone) || !e.nome.trim() || typeof e.marcas === "string")) return erro(route, 400, "VALIDATION_ERROR", { campos: ["entram"] });
      const rel = (e: { marcas: Marcas | string }) => relacaoDe(e.marcas as Marcas);
      const ficam = ativos(x.id).filter((v) => !saem.some((s) => s.id === v.id));
      const gatilho = entram.some((e) => rel(e) === "INQUILINO") || ativos(x.id).some((v) => saem.some((s) => s.id === v.id) && v.proprietario);
      if (gatilho && (ficam.some((v) => v.relacao === "INQUILINO") || entram.some((e) => rel(e) === "INQUILINO"))
        && !ficam.some((v) => v.proprietario) && !entram.some((e) => (e.marcas as Marcas).proprietario)) {
        return erro(route, 400, "VALIDATION_ERROR", { motivo: "FALTA_PROPRIETARIO" });
      }
      for (const s of saem) Object.assign(m.vinculos.find((v) => v.id === s.id)!, { estado: "ENCERRADO", principal: false, motivo: "MUDANCA", dataSaida: corpo.data, encerradoEm: "2026-10-16T16:00:00Z" });
      for (const e of entram) {
        const novo = { id: novoId(), nome: e.nome.trim(), telefone: normalizar(e.telefone)!, versao: 1 };
        m.contatos.push(novo);
        ligar(novo.id, x.id, e.marcas as Marcas, e.recebeComunicados);
      }
      return route.fulfill({ json: { saem: saem.length, entram: entram.length } });
    }
  }
  if (caminho === "/v1/condominio/estrutura") {
    const c = conflito(m.estrutura, corpo.versao); if (c) return c;
    if (corpo.agrupamento === "NENHUM" && m.blocos.some((b) => b.ativo)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ESTRUTURA_COM_BLOCOS" });
    m.estrutura = { agrupamento: String(corpo.agrupamento), usaAndar: corpo.usaAndar === true, versao: m.estrutura.versao + 1 };
    return route.fulfill({ json: { versao: m.estrutura.versao } });
  }
  if (caminho === "/v1/condominio/unidades" && metodo === "POST") {
    const lista = corpo.unidades as { identificacao: string; andar: string | null }[];
    const ja = lista.filter((l) => m.unidades.some((x) => mesma(x, corpo.blocoId, l.andar, l.identificacao)));
    const novas = lista.filter((l) => !ja.includes(l));
    for (const l of novas) m.unidades.push({ id: novoId(), blocoId: (corpo.blocoId as string) ?? null, andar: l.andar ?? null, identificacao: l.identificacao, ativa: true, versao: 1 });
    return route.fulfill({ status: 201, json: { criadas: novas.length, jaExistiam: ja.map((l) => l.identificacao) } });
  }
  const bl = /^\/v1\/condominio\/blocos(?:\/([^/]+))?$/.exec(caminho);
  if (bl) {
    const nome = String(corpo.nome ?? "").trim();
    if (m.blocos.some((b) => b.ativo && b.id !== bl[1] && b.nome.toLowerCase() === nome.toLowerCase())) return erro(route, 400, "VALIDATION_ERROR", { motivo: "NOME_REPETIDO" });
    if (!bl[1]) {
      const b = { id: novoId(), nome, ordem: m.blocos.length + 1, ativo: true, versao: 1 };
      m.blocos.push(b);
      return route.fulfill({ status: 201, json: { id: b.id, versao: 1 } });
    }
    const b = m.blocos.find((x) => x.id === bl[1]);
    if (!b) return erro(route, 404, "NOT_FOUND");
    const c = conflito(b, corpo.versao); if (c) return c;
    if (b.ativo && corpo.ativo === false && m.unidades.some((x) => x.blocoId === b.id && x.ativa)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "BLOCO_COM_UNIDADES" });
    Object.assign(b, { nome, ativo: corpo.ativo ?? b.ativo, versao: b.versao + 1 });
    return route.fulfill({ json: { id: b.id, versao: b.versao } });
  }
  if (caminho === "/v1/condominio/moradores") {
    const url = new URL(route.request().url());
    const busca = (url.searchParams.get("busca") ?? "").toLowerCase();
    const estado = url.searchParams.get("estado");
    const itens = m.vinculos.filter((v) => v.estado !== "ENCERRADO" && (!estado || v.estado === estado
      || (estado === "SEM_EMAIL" && contato(v.contatoId).emailSituacao !== "CONFIRMADO")
      || (estado === "SEM_WHATSAPP" && !recebeNoWhatsapp(contato(v.contatoId))))).map((v) => {
      const c = contato(v.contatoId);
      const x = unidade(v.unidadeId)!;
      return { vinculoId: v.id, contatoId: c.id, nome: c.nome!, telefone: c.telefone!, unidadeId: x.id, unidade: x.identificacao,
        andar: x.andar, bloco: m.blocos.find((b) => b.id === x.blocoId)?.nome ?? null, relacao: v.relacao, principal: v.principal, estado: v.estado, origem: v.origem, versao: v.versao,
        emailSituacao: c.emailSituacao, comunicadosWhatsapp: c.comunicadosWhatsapp ?? "SEM_RESPOSTA" };
    }).filter((i) => !busca || i.nome.toLowerCase().includes(busca) || i.unidade.toLowerCase().startsWith(busca) || (i.bloco ?? "").toLowerCase().includes(busca)
      || (busca.replace(/\D/g, "").length >= 4 && i.telefone.includes(busca.replace(/\D/g, ""))));
    const semEmail = new Set(m.vinculos.filter((v) => v.estado !== "ENCERRADO" && contato(v.contatoId).emailSituacao !== "CONFIRMADO").map((v) => v.contatoId)).size;
    const semWhatsapp = new Set(m.vinculos.filter((v) => v.estado !== "ENCERRADO" && !recebeNoWhatsapp(contato(v.contatoId))).map((v) => v.contatoId)).size;
    return route.fulfill({ json: { itens, total: itens.length, pagina: 1, porPagina: 50, aConfirmar: resumoMoradores(m).aConfirmar, semEmail, semWhatsapp,
      comunicadosWhatsappLigado: m.zap.ligado, podeEditar: edita, podeConfirmar: confirma } });
  }
  // E-mail do contato (CD-13): vira "esperando confirmação"; só a própria pessoa confirma.
  const em = /^\/v1\/condominio\/contatos\/([^/]+)\/email(\/reenviar)?$/.exec(caminho);
  if (em) {
    const c = m.contatos.find((x) => x.id === em[1]);
    if (!c) return route.fulfill({ status: 404, json: { erro: { codigo: "NOT_FOUND" } } });
    if (!edita) return route.fulfill({ status: 403, json: { erro: { codigo: "FORBIDDEN" } } });
    if (em[2]) return route.fulfill({ json: { ok: true } });
    if (corpo.versao !== c.versao) return route.fulfill({ status: 409, json: { erro: { codigo: "VERSION_CONFLICT", detalhes: { versao: c.versao } } } });
    const novo = corpo.email ? String(corpo.email).trim() : "";
    if (novo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novo)) return route.fulfill({ status: 400, json: { erro: { codigo: "VALIDATION_ERROR", detalhes: { campos: ["email"] } } } });
    if (novo.toLowerCase() !== (c.email ?? "").toLowerCase()) Object.assign(c, { email: novo || undefined, emailSituacao: novo ? "PENDENTE" : undefined });
    c.emailComunicados = corpo.recebe !== false;
    c.versao++;
    return route.fulfill({ json: { versao: c.versao, situacao: c.emailSituacao ?? null, confirmacaoNaFila: !!novo } });
  }
  const co = /^\/v1\/condominio\/contatos\/([^/]+)(\/remover-dados)?$/.exec(caminho);
  if (co) {
    const c = m.contatos.find((x) => x.id === co[1]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    const f = conflito(c, corpo.versao); if (f) return f;
    if (co[2]) {
      if (m.vinculos.some((v) => v.contatoId === c.id && v.estado !== "ENCERRADO")) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONTATO_COM_UNIDADE" });
      Object.assign(c, { nome: null, telefone: null, versao: c.versao + 1 });
      return route.fulfill({ json: { ok: true } });
    }
    const tel = normalizar(corpo.telefone);
    if (!tel) return erro(route, 400, "VALIDATION_ERROR", { campos: ["telefone"] });
    Object.assign(c, { nome: String(corpo.nome).trim(), telefone: tel, versao: c.versao + 1 });
    return route.fulfill({ json: { versao: c.versao, avisos: compartilhado(c) ? ["TELEFONE_COMPARTILHADO"] : [] } });
  }
  if (caminho === "/v1/condominio/vinculos-unidade/confirmar") {
    if (!confirma) return erro(route, 403, "FORBIDDEN");
    const itens = corpo.itens as { id: string; versao: number }[];
    for (const i of itens) {
      const v = m.vinculos.find((x) => x.id === i.id)!;
      const c = conflito(v, i.versao); if (c) return c;
    }
    for (const i of itens) Object.assign(m.vinculos.find((x) => x.id === i.id)!, { estado: "CONFIRMADO" }, { versao: i.versao + 1 });
    return route.fulfill({ json: { confirmados: itens.length } });
  }
  const vu = /^\/v1\/condominio\/vinculos-unidade\/([^/]+)(\/encerrar)?$/.exec(caminho);
  if (vu) {
    const v = m.vinculos.find((x) => x.id === vu[1] && x.estado !== "ENCERRADO");
    if (!v) return erro(route, 404, "NOT_FOUND");
    const c = conflito(v, corpo.versao); if (c) return c;
    if (vu[2]) {
      if (corpo.motivo === "RECUSADO" && !confirma) return erro(route, 403, "FORBIDDEN");
      if (corpo.motivo !== "RECUSADO" && corpo.dataSaida && v.ocupaDesde && String(corpo.dataSaida) < v.ocupaDesde) {
        return erro(route, 400, "VALIDATION_ERROR", { campos: ["dataSaida"] });
      }
      Object.assign(v, { estado: "ENCERRADO", principal: false, motivo: corpo.motivo, dataSaida: corpo.motivo === "RECUSADO" ? null : corpo.dataSaida ?? null,
        encerradoEm: "2026-10-16T16:00:00Z", versao: v.versao + 1 });
      return route.fulfill({ json: { ok: true } });
    }
    const marcas = lerMarcas((corpo.marcas ?? {}) as Record<string, unknown>);
    if (typeof marcas === "string") return erro(route, 400, "VALIDATION_ERROR", { campos: [marcas] });
    if (marcas.principal && !v.principal) for (const o of ativos(v.unidadeId)) o.principal = false;
    Object.assign(v, marcas, { relacao: relacaoDe(marcas), recebeComunicados: corpo.recebeComunicados, versao: v.versao + 1 });
    return route.fulfill({ json: { versao: v.versao } });
  }
  if (caminho === "/v1/condominio/importacoes") {
    const linhas = corpo.linhas as { bloco: string | null; andar: string | null; unidade: string; nome: string; telefone: string; relacao: string;
      mora?: boolean | null; responsavel?: boolean | null; parentesco?: string | null; ocupaDesde?: string | null }[];
    m.importacoes.push(linhas);
    const r = { linhas: linhas.length, blocos: 0, unidades: 0, contatos: 0, vinculos: 0, ignoradas: 0 };
    for (const l of linhas) {
      let b = l.bloco ? m.blocos.find((x) => x.ativo && x.nome.toLowerCase() === l.bloco!.toLowerCase()) : undefined;
      if (l.bloco && !b) { b = { id: novoId(), nome: l.bloco, ordem: m.blocos.length + 1, ativo: true, versao: 1 }; m.blocos.push(b); r.blocos++; }
      let x = m.unidades.find((y) => mesma(y, b?.id ?? null, l.andar, l.unidade));
      if (!x) { x = { id: novoId(), blocoId: b?.id ?? null, andar: l.andar, identificacao: l.unidade, ativa: true, versao: 1 }; m.unidades.push(x); r.unidades++; }
      let c = m.contatos.find((y) => y.telefone === l.telefone && y.nome?.toLowerCase() === l.nome.toLowerCase());
      if (!c) { c = { id: novoId(), nome: l.nome, telefone: l.telefone, versao: 1 }; m.contatos.push(c); r.contatos++; }
      if (ativos(x.id).some((v) => v.contatoId === c!.id)) r.ignoradas++;
      else {
        const base = MARCAS_DA_RELACAO[l.relacao]!;
        ligar(c.id, x.id, { ...base, mora: l.mora ?? base.mora, principal: !!l.responsavel && !ativos(x.id).some((v) => v.principal),
          parentesco: l.parentesco ?? null, ocupaDesde: l.ocupaDesde ?? null }, true, "PLANILHA");
        r.vinculos++;
      }
    }
    if (linhas.some((l) => l.andar)) m.estrutura.usaAndar = true;
    return route.fulfill({ status: 201, json: { ...r, semProprietario: resumoMoradores(m).semProprietario } });
  }
  return erro(route, 404, "NOT_FOUND");
}

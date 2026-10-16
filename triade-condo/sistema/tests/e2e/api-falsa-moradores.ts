// Parte de moradores e unidades da API falsa da Plataforma (passo 3). As regras de verdade
// estão testadas no banco (pgTAP 009) e na API (Deno); aqui só o bastante para a tela.
import type { Route } from "@playwright/test";

interface Bloco { id: string; nome: string; ordem: number; ativo: boolean; versao: number }
interface Unidade { id: string; blocoId: string | null; andar: string | null; identificacao: string; ativa: boolean; versao: number }
interface Contato { id: string; nome: string | null; telefone: string | null; versao: number }
interface Vinculo {
  id: string; contatoId: string; unidadeId: string; relacao: string; principal: boolean; recebeComunicados: boolean;
  estado: "PENDENTE" | "CONFIRMADO" | "ENCERRADO"; origem: "PAINEL" | "PLANILHA"; criadoEm: string; versao: number;
  motivo?: string; dataSaida?: string | null; encerradoEm?: string;
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
  const marina = ct("Marina Souza", "+5561999990001");
  const pedro = ct("Pedro Souza", "+5561999990002");
  const joana = ct("Joana Lima", "+5561988887777");
  const paulo = ct("Paulo Lima", "+5561988887777");
  const v = (contato: Contato, unidadeId: string, relacao: string, estado: "PENDENTE" | "CONFIRMADO", principal = false, origem: "PAINEL" | "PLANILHA" = "PAINEL"): Vinculo =>
    ({ id: novoId(), contatoId: contato.id, unidadeId, relacao, principal, recebeComunicados: true, estado, origem, criadoEm: "2026-10-16T15:00:00Z", versao: 1 });
  return {
    estrutura: { agrupamento: "TORRE", usaAndar: false, versao: 1 },
    blocos: [torreA, torreB],
    unidades,
    contatos: [marina, pedro, joana, paulo],
    vinculos: [v(marina, A101, "PROPRIETARIO", "CONFIRMADO", true), v(pedro, A101, "FAMILIAR", "CONFIRMADO"), v(joana, A102, "INQUILINO", "CONFIRMADO", true),
      v(paulo, A102, "FAMILIAR", "PENDENTE", false, "PLANILHA")],
    importacoes: [] as unknown[],
  };
}

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
  };
}

/** Atende as rotas do passo 3; devolve null quando a rota não é daqui. */
export async function rotasMoradores(route: Route, m: EstadoMoradores, caminho: string, metodo: string, corpo: Record<string, unknown>, pode: (a: string) => boolean) {
  if (!/^\/v1\/condominio\/(unidades|blocos|moradores|contatos|vinculos-unidade|importacoes|estrutura)/.test(caminho)) return null;
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
  const ligar = (contatoId: string, unidadeId: string, relacao: string, principal: boolean, recebe: boolean, origem: "PAINEL" | "PLANILHA" = "PAINEL") => {
    if (principal) for (const v of ativos(unidadeId)) v.principal = false;
    const v: Vinculo = { id: novoId(), contatoId, unidadeId, relacao, principal, recebeComunicados: recebe, estado: origem === "PAINEL" && confirma ? "CONFIRMADO" : "PENDENTE",
      origem, criadoEm: "2026-10-16T16:00:00Z", versao: 1 };
    m.vinculos.push(v);
    return v;
  };

  if (caminho === "/v1/condominio/unidades" && metodo === "GET") {
    const ordemBloco = (id: string | null) => (id ? m.blocos.find((b) => b.id === id)!.ordem : 0);
    const lista = [...m.unidades].sort((a, b) => Number(b.ativa) - Number(a.ativa) || ordemBloco(a.blocoId) - ordemBloco(b.blocoId)
      || chaveAndar(a.andar).localeCompare(chaveAndar(b.andar)) || chave(a.identificacao).localeCompare(chave(b.identificacao)));
    return route.fulfill({ json: {
      estrutura: m.estrutura,
      blocos: m.blocos,
      unidades: lista.map((x) => ({ ...x,
        confirmados: ativos(x.id).filter((v) => v.estado === "CONFIRMADO").length,
        pendentes: ativos(x.id).filter((v) => v.estado === "PENDENTE").length,
        principal: (() => { const p = ativos(x.id).find((v) => v.principal); return p ? contato(p.contatoId).nome : null; })() })),
      resumo: resumoMoradores(m), podeEditar: edita, podeConfirmar: confirma,
    } });
  }
  const un = /^\/v1\/condominio\/unidades\/([^/]+)(?:\/(contatos|mudanca))?$/.exec(caminho);
  if (un) {
    const x = unidade(un[1]!);
    if (!x) return erro(route, 404, "NOT_FOUND");
    if (!un[2] && metodo === "GET") {
      return route.fulfill({ json: {
        unidade: { ...x, bloco: m.blocos.find((b) => b.id === x.blocoId)?.nome ?? null },
        contatos: ativos(x.id).sort((a, b) => Number(a.estado === "PENDENTE") - Number(b.estado === "PENDENTE") || Number(b.principal) - Number(a.principal)).map((v) => {
          const c = contato(v.contatoId);
          return { vinculoId: v.id, contatoId: c.id, nome: c.nome, telefone: c.telefone, contatoVersao: c.versao, relacao: v.relacao, principal: v.principal,
            recebeComunicados: v.recebeComunicados, estado: v.estado, origem: v.origem, desde: v.criadoEm, versao: v.versao, telefoneCompartilhado: compartilhado(c),
            outrasUnidades: m.vinculos.filter((o) => o.contatoId === c.id && o.unidadeId !== x.id && o.estado !== "ENCERRADO").map((o) => nomeUnidade(unidade(o.unidadeId)!)) };
        }),
        anteriores: m.vinculos.filter((v) => v.unidadeId === x.id && v.estado === "ENCERRADO").map((v) => {
          const c = contato(v.contatoId);
          return { vinculoId: v.id, contatoId: c.id, nome: c.nome, relacao: v.relacao, motivo: v.motivo, dataSaida: v.dataSaida ?? null, encerradoEm: v.encerradoEm,
            dadosRemovidos: c.nome === null, contatoVersao: c.versao, semVinculoAtivo: !m.vinculos.some((o) => o.contatoId === c.id && o.estado !== "ENCERRADO") };
        }),
        podeEditar: edita, podeConfirmar: confirma,
      } });
    }
    if (!un[2] && metodo === "PUT") {
      const c = conflito(x, corpo.versao); if (c) return c;
      if (x.ativa && corpo.ativa === false && ativos(x.id).length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "UNIDADE_COM_CONTATOS" });
      Object.assign(x, { identificacao: String(corpo.identificacao).trim(), blocoId: corpo.blocoId ?? null, andar: corpo.andar ?? null, ativa: corpo.ativa ?? x.ativa,
        versao: x.versao + 1 });
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
      if (ativos(x.id).some((v) => v.contatoId === id)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "CONTATO_JA_NA_UNIDADE" });
      const v = ligar(id, x.id, String(corpo.relacao), corpo.principal === true, corpo.recebeComunicados !== false);
      return route.fulfill({ status: 201, json: { vinculoId: v.id, contatoId: id, avisos: compartilhado(contato(id)) ? ["TELEFONE_COMPARTILHADO"] : [] } });
    }
    if (un[2] === "mudanca") {
      const saem = corpo.saem as { id: string; versao: number }[];
      const entram = corpo.entram as { nome: string; telefone: string; relacao: string; principal: boolean; recebeComunicados: boolean }[];
      if (!saem.length && !entram.length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "MUDANCA_VAZIA" });
      if (entram.some((e) => !normalizar(e.telefone) || !e.nome.trim())) return erro(route, 400, "VALIDATION_ERROR", { campos: ["entram"] });
      for (const s of saem) Object.assign(m.vinculos.find((v) => v.id === s.id)!, { estado: "ENCERRADO", principal: false, motivo: "MUDANCA", dataSaida: corpo.data, encerradoEm: "2026-10-16T16:00:00Z" });
      for (const e of entram) {
        const novo = { id: novoId(), nome: e.nome.trim(), telefone: normalizar(e.telefone)!, versao: 1 };
        m.contatos.push(novo);
        ligar(novo.id, x.id, e.relacao, e.principal, e.recebeComunicados);
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
    const itens = m.vinculos.filter((v) => v.estado !== "ENCERRADO" && (!estado || v.estado === estado)).map((v) => {
      const c = contato(v.contatoId);
      const x = unidade(v.unidadeId)!;
      return { vinculoId: v.id, contatoId: c.id, nome: c.nome!, telefone: c.telefone!, unidadeId: x.id, unidade: x.identificacao,
        andar: x.andar, bloco: m.blocos.find((b) => b.id === x.blocoId)?.nome ?? null, relacao: v.relacao, principal: v.principal, estado: v.estado, origem: v.origem, versao: v.versao };
    }).filter((i) => !busca || i.nome.toLowerCase().includes(busca) || i.unidade.toLowerCase().startsWith(busca) || (i.bloco ?? "").toLowerCase().includes(busca)
      || (busca.replace(/\D/g, "").length >= 4 && i.telefone.includes(busca.replace(/\D/g, ""))));
    return route.fulfill({ json: { itens, total: itens.length, pagina: 1, porPagina: 50, aConfirmar: resumoMoradores(m).aConfirmar, podeEditar: edita, podeConfirmar: confirma } });
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
      Object.assign(v, { estado: "ENCERRADO", principal: false, motivo: corpo.motivo, dataSaida: corpo.dataSaida ?? null, encerradoEm: "2026-10-16T16:00:00Z", versao: v.versao + 1 });
      return route.fulfill({ json: { ok: true } });
    }
    if (corpo.principal && !v.principal) for (const o of ativos(v.unidadeId)) o.principal = false;
    Object.assign(v, { relacao: corpo.relacao, principal: corpo.principal, recebeComunicados: corpo.recebeComunicados, versao: v.versao + 1 });
    return route.fulfill({ json: { versao: v.versao } });
  }
  if (caminho === "/v1/condominio/importacoes") {
    const linhas = corpo.linhas as { bloco: string | null; andar: string | null; unidade: string; nome: string; telefone: string; relacao: string }[];
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
      else { ligar(c.id, x.id, l.relacao, false, true, "PLANILHA"); r.vinculos++; }
    }
    if (linhas.some((l) => l.andar)) m.estrutura.usaAndar = true;
    return route.fulfill({ status: 201, json: r });
  }
  return erro(route, 404, "NOT_FOUND");
}

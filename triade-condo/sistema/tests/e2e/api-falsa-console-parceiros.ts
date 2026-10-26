// Parceiros e a agenda de demonstrações no Console falso (0310, R17.6; CM-22 e CM-23), ligado pelo
// api-falsa-console-comercial.ts: quatro parceiros como no quadro 339 (a Marta com dois prédios
// ativos e um perdido), a regra de 10% que só a Administração muda, o pagamento registrado; e a
// agenda do quadro 341 (três próximas, uma a registrar, os horários da Carolina, o link da equipe)
// com a página pública do quadro 340, onde o horário das 16:00 do primeiro dia "acabou de ser
// ocupado". As regras de verdade estão no banco (pgTAP 056 e 057) e na API (Deno).
import type { Route } from "@playwright/test";
import type { ComercialConsole, PodeComercial } from "./api-falsa-console-comercial";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
const BIANCA = { id: "2d9e5b20-0000-4000-8000-00000000bb01", nome: "Bianca" };
const SITE = "7a1b2c3d-0000-4000-8000-0000000000a1";
const INDICADO = "7a1b2c3d-0000-4000-8000-0000000000a2";
const LAGO = "7a1b2c3d-0000-4000-8000-0000000000a3";
export const MARTA = "cc6a7b80-0000-4000-8000-0000000000f1";
export const CODIGO_AGENDA = "abcdefghjk23";

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).toISOString();
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function quando(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return `${SEMANA[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}, ${d.toISOString().slice(11, 16)}`;
}
/** Os próximos dias úteis a partir de amanhã. */
function diasUteis(hoje: string, n: number): string[] {
  const r: string[] = [];
  for (let k = 1; r.length < n; k++) {
    const d = somarDias(hoje, k);
    const s = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (s !== 0 && s !== 6) r.push(d);
  }
  return r;
}

export function criarParceirosAgenda(hoje: string) {
  const mes = hoje.slice(0, 7);
  const agora = new Date().toISOString();
  const parceiro = (id: string, tipo: string, nome: string, extra: Json): Json => ({
    id, versao: 1, tipo, nome, ativo: true, anonimizado: false, criadoEm: "2026-06-01T12:00:00Z", indicacoes: 0, indicacoesMes: 0, prediosAtivos: 0, comissaoMes: 0, ...extra,
  });
  const dias = diasUteis(hoje, 5);
  const demo = (id: string, interessadoId: string, condominio: string, inicio: string, extra: Json): Json => ({
    id, versao: 1, inicio, fim: new Date(Date.parse(inicio) + 30 * 60_000).toISOString(), quando: quando(inicio), situacao: "MARCADA", origem: "LINK", remarcacoes: 0,
    interessado: { id: interessadoId, versao: 1, condominio, etapa: "DEMO_MARCADA", temEmail: true }, com: CAROLINA, confirmacao: "ENVIADO", lembrete: "NA_FILA", ...extra,
  });
  return {
    mes,
    regra: { percentual: 10, prazoMeses: null as number | null, versao: 1, alteradoEm: agora, alteradoPor: "Carolina" },
    lista: [
      parceiro(MARTA, "SINDICO_PROFISSIONAL", "Marta Lins", { whatsapp: "5561999991111", email: "marta@exemplo.com.br", indicacoes: 3, indicacoesMes: 1,
        ultimaIndicacaoEm: agora, prediosAtivos: 2, comissaoMes: 4580 }),
      parceiro("cc6a7b80-0000-4000-8000-0000000000f2", "ADMINISTRADORA", "Contábil Norte", { cnpj: "12345678000190", indicacoes: 5, indicacoesMes: 2, ultimaIndicacaoEm: agora,
        prediosAtivos: 1, comissaoMes: 2290 }),
      parceiro("cc6a7b80-0000-4000-8000-0000000000f3", "CONSTRUTORA", "Construtora Planalto", { indicacoes: 1, ultimaIndicacaoEm: "2026-05-02T12:00:00Z", semIndicacao90: true }),
      parceiro("cc6a7b80-0000-4000-8000-0000000000f4", "CLIENTE", "Paulo Dias", { indicacoes: 1, prediosAtivos: 1, comissaoMes: 2290 }),
    ] as Json[],
    comissoes: [
      { comissaoId: "dd7b8c90-0000-4000-8000-0000000000e1", parceiroId: MARTA, versao: 1, interessadoId: SITE, condominio: "Residencial Pequi", desde: "2026-08-01",
        mensalidade: 22900, comissao: 2290, situacao: "ATIVA", percentual: 10 },
      { comissaoId: "dd7b8c90-0000-4000-8000-0000000000e2", parceiroId: MARTA, versao: 1, interessadoId: INDICADO, condominio: "Condomínio Parque das Flores", desde: `${mes}-01`,
        mensalidade: 22900, comissao: 2290, situacao: "ATIVA", percentual: 10 },
      { comissaoId: "dd7b8c90-0000-4000-8000-0000000000e3", parceiroId: MARTA, versao: 2, interessadoId: LAGO, condominio: "Edifício Mangaba", desde: "2026-07-01",
        mensalidade: 22900, comissao: null, situacao: "ENCERRADA", percentual: 10, semComissaoDesde: "2026-09-01", motivo: "Síndico novo trocou de sistema" },
    ] as Json[],
    pagamentos: {} as Record<string, Json>,
    agenda: {
      dias,
      demos: [
        demo("ee8c9da0-0000-4000-8000-0000000000a1", SITE, "Residencial Jatobá", instante(dias[0]!, "14:00"), {}),
        demo("ee8c9da0-0000-4000-8000-0000000000a2", INDICADO, "Edifício Ipê Amarelo", instante(dias[1]!, "10:00"), { origem: "MAO", lembrete: "ENVIADO" }),
        demo("ee8c9da0-0000-4000-8000-0000000000a3", LAGO, "Condomínio Lago Sul", instante(somarDias(hoje, -1), "10:00"), { com: BIANCA, remarcacoes: 1 }),
      ] as Json[],
      disponibilidade: {
        [CAROLINA.id]: { configurada: true, versao: 1, faixas: [{ dia: 1, de: "10:00", ate: "12:00" }, { dia: 1, de: "14:00", ate: "17:00" }, { dia: 2, de: "10:00", ate: "12:00" },
          { dia: 2, de: "14:00", ate: "17:00" }, { dia: 4, de: "14:00", ate: "17:00" }, { dia: 5, de: "10:00", ate: "12:00" }], duracaoMinutos: 30, intervaloMinutos: 15,
          avisoDiasUteis: 1, horizonteDias: 14, salaUrl: "https://meet.exemplo.com/triade", ativa: true },
      } as Record<string, Json>,
      bloqueios: [] as Json[],
      links: [{ codigo: CODIGO_AGENDA, criadoEm: agora }] as Json[],
      /** O horário que "acabou de ser ocupado" na página pública. */
      corrida: instante(dias[0]!, "16:00"),
      ocupados: [instante(dias[0]!, "14:00"), instante(dias[0]!, "10:00")] as string[],
      agendados: [] as Json[],
    },
  };
}
export type ParceirosFalso = ReturnType<typeof criarParceirosAgenda>;

function linhaParceiro(x: ParceirosFalso, l: Json): Json {
  const pago = x.pagamentos[`${l.id}|${x.mes}`];
  return { ...l, ...(pago ? { pagoMes: { valor: pago.valor, pagoEm: pago.pagoEm } } : {}) };
}

function extrato(x: ParceirosFalso, l: Json, mes: string, pode: PodeComercial): Json {
  const linhas = x.comissoes.filter((c) => c.parceiroId === l.id && String(c.desde).slice(0, 7) <= mes).map(({ parceiroId: _p, ...c }) => c);
  const total = linhas.reduce((s, c) => s + (typeof c.comissao === "number" ? c.comissao : 0), 0);
  const pago = x.pagamentos[`${l.id}|${mes}`];
  return {
    parceiro: linhaParceiro(x, l), mes, linhas, total, regra: x.regra, podeComissao: !!pode.comissao,
    ...(pago ? { pago, diferenca: total - Number(pago.valor) } : {}),
    indicacoes: l.id === MARTA ? [{ id: SITE, condominio: "Residencial Jatobá", etapa: "NOVO", criadoEm: "2026-10-02T12:00:00Z" }] : [],
  };
}

function demoNoFunil(p: ComercialConsole, interessadoId: unknown) {
  const i = p.interessados.find((y) => y.id === interessadoId);
  if (i && ["NOVO", "EM_CONTATO"].includes(String(i.etapa))) i.etapa = "DEMO_MARCADA";
}

export async function rotasParceirosAgenda(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL) {
  const x = p.parceiros;
  const escreve = metodo !== "GET";
  const ehParceiros = /^\/v1\/comercial\/(parceiros|comissao|comissoes)/.test(caminho);
  const ehAgenda = /^\/v1\/comercial\/(agenda|demonstracoes)/.test(caminho) || /^\/v1\/comercial\/interessados\/[0-9a-f-]{36}\/demonstracoes$/.test(caminho);
  // O convite da mensagem pronta (0310, A): o link de quem atende com um ?c= novo a cada mensagem.
  const mconv = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})\/convite-agenda$/.exec(caminho);
  if (mconv && metodo === "POST") {
    if (!pode.editar) return erro(route, 403, "FORBIDDEN");
    const i = p.interessados.find((y) => y.id === mconv[1]);
    if (!i) return erro(route, 404, "NOT_FOUND");
    if (!i.linkAgenda) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_LINK_AGENDA" });
    const convite = String(p.pedidos.length).padStart(32, "c");
    return route.fulfill({ json: { codigo: i.linkAgenda, convite } });
  }
  if (!ehParceiros && !ehAgenda) return null;
  const soAdministracao = caminho === "/v1/comercial/comissao/regra" || /\/(pagamentos)$/.test(caminho) || /^\/v1\/comercial\/comissoes\//.test(caminho);
  if (soAdministracao && !pode.comissao) return erro(route, 403, "FORBIDDEN");
  if (escreve && !pode.editar) return erro(route, 403, "FORBIDDEN");

  // ---- Parceiros (CM-22)
  if (caminho === "/v1/comercial/parceiros" && !escreve) {
    const mes = url.searchParams.get("mes") ?? x.mes;
    return route.fulfill({ json: { mes, regra: x.regra, parceiros: x.lista.map((l) => linhaParceiro(x, l)), podeEditar: pode.editar, podeComissao: !!pode.comissao, podeApagar: pode.modelos } });
  }
  if (caminho === "/v1/comercial/parceiros" && metodo === "POST") {
    if (!corpo.tipo) return erro(route, 400, "VALIDATION_ERROR", { campos: ["tipo"] });
    if (String(corpo.nome ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["nome"] });
    const zap = String(corpo.whatsapp ?? "").replace(/\D/g, "");
    if (zap && x.lista.some((l) => l.whatsapp && String(l.whatsapp).endsWith(zap.slice(-8)))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "DUPLICADO" });
    const id = `cc6a7b80-0000-4000-8000-${String(x.lista.length + 100).padStart(12, "0")}`;
    x.lista.push({ id, versao: 1, tipo: corpo.tipo, nome: String(corpo.nome).trim(), ...(zap ? { whatsapp: zap.length <= 11 ? `55${zap}` : zap } : {}),
      ativo: true, anonimizado: false, criadoEm: new Date().toISOString(), indicacoes: 0, indicacoesMes: 0, prediosAtivos: 0, comissaoMes: 0, semIndicacao90: false });
    return route.fulfill({ status: 201, json: { id, versao: 1 } });
  }
  if (caminho === "/v1/comercial/comissao/regra" && metodo === "PUT") {
    if (corpo.versao !== x.regra.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: x.regra.versao });
    Object.assign(x.regra, { percentual: corpo.percentual, prazoMeses: corpo.prazoMeses ?? null, versao: x.regra.versao + 1 });
    return route.fulfill({ json: x.regra });
  }
  const mc = /^\/v1\/comercial\/comissoes\/([0-9a-f-]{36})\/encerrar$/.exec(caminho);
  if (mc) {
    const c = x.comissoes.find((y) => y.comissaoId === mc[1]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    Object.assign(c, { semComissaoDesde: `${corpo.desde}-01`, motivo: corpo.motivo, versao: Number(c.versao) + 1,
      ...(String(corpo.desde) <= x.mes ? { comissao: null, situacao: "ENCERRADA" } : {}) });
    return route.fulfill({ json: { id: c.comissaoId, versao: c.versao } });
  }
  const mp = /^\/v1\/comercial\/parceiros\/([0-9a-f-]{36})(\/[a-z]+)?$/.exec(caminho);
  if (mp) {
    const l = x.lista.find((y) => y.id === mp[1]);
    if (!l) return erro(route, 404, "NOT_FOUND");
    const acao = mp[2] ?? "";
    if (acao === "/extrato") return route.fulfill({ json: extrato(x, l, url.searchParams.get("mes") ?? x.mes, pode) });
    if (acao === "" && metodo === "PUT") {
      if (corpo.versao !== l.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: l.versao });
      Object.assign(l, { tipo: corpo.tipo, nome: corpo.nome, ativo: corpo.ativo !== false, versao: Number(l.versao) + 1 });
      return route.fulfill({ json: { id: l.id, versao: l.versao } });
    }
    if (acao === "/indicar" && metodo === "POST") {
      if (!corpo.contatoAceito) return erro(route, 400, "VALIDATION_ERROR", { campos: ["contatoAceito"] });
      if (String(corpo.condominio ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["condominio"] });
      l.indicacoes = Number(l.indicacoes) + 1;
      l.indicacoesMes = Number(l.indicacoesMes) + 1;
      return route.fulfill({ status: 201, json: { id: INDICADO, juntado: false, parceiroId: l.id } });
    }
    if (acao === "/pagamentos" && metodo === "POST") {
      const chave = `${l.id}|${corpo.mes}`;
      if (x.pagamentos[chave]) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PAGAMENTO_REGISTRADO" });
      const e = extrato(x, l, String(corpo.mes), pode);
      x.pagamentos[chave] = { valor: corpo.valor, calculado: e.total, pagoEm: corpo.pagoEm, ...(corpo.observacao ? { observacao: corpo.observacao } : {}),
        registradoEm: new Date().toISOString(), registradoPor: "Carolina" };
      return route.fulfill({ status: 201, json: { id: "pg1", calculado: e.total, valor: corpo.valor, diferenca: Number(e.total) - Number(corpo.valor) } });
    }
    if (acao === "/apagar" && metodo === "POST") {
      Object.assign(l, { nome: "Parceiro apagado (LGPD)", whatsapp: undefined, email: undefined, cnpj: undefined, observacao: undefined, ativo: false, anonimizado: true });
      return route.fulfill({ json: { id: l.id, anonimizado: true } });
    }
    return erro(route, 404, "NOT_FOUND");
  }

  // ---- Agenda (CM-23)
  const a = x.agenda;
  const agora = Date.now();
  const json = (d: Json) => d;
  if (caminho === "/v1/comercial/agenda" && !escreve) {
    const marcadas = a.demos.filter((d) => d.situacao === "MARCADA");
    return route.fulfill({ json: {
      proximas: marcadas.filter((d) => Date.parse(String(d.fim)) > agora).sort((m, n) => String(m.inicio).localeCompare(String(n.inicio))),
      aRegistrar: marcadas.filter((d) => Date.parse(String(d.fim)) <= agora),
      recentes: a.demos.filter((d) => d.situacao !== "MARCADA"),
      disponibilidades: [BIANCA, CAROLINA].map((pessoa) => {
        const d = a.disponibilidade[pessoa.id];
        return d ? { pessoa, ...d } : { pessoa, configurada: false, faixas: [], duracaoMinutos: 30, intervaloMinutos: 15, avisoDiasUteis: 1, horizonteDias: 14, ativa: false };
      }),
      bloqueios: a.bloqueios, links: a.links, equipe: [BIANCA, CAROLINA], eu: CAROLINA.id, podeEditar: pode.editar,
    } });
  }
  const md = /^\/v1\/comercial\/agenda\/disponibilidade\/([0-9a-f-]{36})$/.exec(caminho);
  if (md && metodo === "PUT") {
    const atual = a.disponibilidade[md[1]!];
    if ((atual?.versao ?? null) !== (corpo.versao ?? null)) return erro(route, 409, "VERSION_CONFLICT", { versao: atual?.versao });
    const { versao: _v, ...resto } = corpo;
    a.disponibilidade[md[1]!] = { ...resto, configurada: true, versao: Number(atual?.versao ?? 0) + 1 };
    return route.fulfill({ json: { id: "disp", versao: a.disponibilidade[md[1]!]!.versao } });
  }
  if (caminho === "/v1/comercial/agenda/bloqueios" && metodo === "POST") {
    const pessoa = [BIANCA, CAROLINA].find((y) => y.id === corpo.pessoaId) ?? CAROLINA;
    const id = `ff9daeb0-0000-4000-8000-${String(a.bloqueios.length + 1).padStart(12, "0")}`;
    a.bloqueios.push({ id, pessoa, de: corpo.de, ate: corpo.ate, ...(corpo.motivo ? { motivo: corpo.motivo } : {}) });
    return route.fulfill({ status: 201, json: { id } });
  }
  const mb = /^\/v1\/comercial\/agenda\/bloqueios\/([0-9a-f-]{36})\/cancelar$/.exec(caminho);
  if (mb) {
    a.bloqueios = a.bloqueios.filter((b) => b.id !== mb[1]);
    return route.fulfill({ json: { id: mb[1] } });
  }
  if (caminho === "/v1/comercial/agenda/links" && metodo === "POST") {
    const de = (corpo.pessoaId as string | null) ?? undefined;
    let l = a.links.find((y) => (y.pessoaId ?? undefined) === de);
    if (l && corpo.trocar) { a.links = a.links.filter((y) => y !== l); l = undefined; }
    if (!l) {
      l = { codigo: `novolink${String(a.links.length + 2).padStart(4, "2")}`.slice(0, 12), ...(de ? { pessoaId: de } : {}), criadoEm: new Date().toISOString() };
      a.links.push(l);
    }
    return route.fulfill({ json: { codigo: l.codigo, pessoaId: de ?? null } });
  }
  const mm = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})\/demonstracoes$/.exec(caminho);
  if (mm && metodo === "POST") {
    const i = p.interessados.find((y) => y.id === mm[1]);
    if (!i) return erro(route, 404, "NOT_FOUND");
    if (a.demos.some((d) => d.situacao === "MARCADA" && (d.interessado as Json).id === i.id && Date.parse(String(d.inicio)) > agora)) {
      return erro(route, 400, "VALIDATION_ERROR", { motivo: "DEMONSTRACAO_MARCADA" });
    }
    const inicio = new Date(String(corpo.inicio)).toISOString();
    const com = [BIANCA, CAROLINA].find((y) => y.id === corpo.pessoaId) ?? CAROLINA;
    const d = json({ id: `ee8c9da0-0000-4000-8000-${String(a.demos.length + 10).padStart(12, "0")}`, versao: 1, inicio,
      fim: new Date(Date.parse(inicio) + Number(corpo.duracaoMinutos ?? 30) * 60_000).toISOString(), quando: quando(inicio), situacao: "MARCADA", origem: "MAO", remarcacoes: 0,
      interessado: { id: i.id, versao: i.versao, condominio: i.condominio, etapa: "DEMO_MARCADA", temEmail: !!i.email }, com,
      ...(corpo.avisar && i.email ? { confirmacao: "NA_FILA", lembrete: "NA_FILA" } : {}) });
    a.demos.push(d);
    demoNoFunil(p, i.id);
    return route.fulfill({ status: 201, json: d });
  }
  const mdemo = /^\/v1\/comercial\/demonstracoes\/([0-9a-f-]{36})\/(remarcar|feita|encerrar)$/.exec(caminho);
  if (mdemo) {
    const d = a.demos.find((y) => y.id === mdemo[1]);
    if (!d) return erro(route, 404, "NOT_FOUND");
    if (corpo.versao !== d.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: d.versao });
    if (mdemo[2] === "remarcar") {
      const inicio = new Date(String(corpo.inicio)).toISOString();
      Object.assign(d, { inicio, fim: new Date(Date.parse(inicio) + 30 * 60_000).toISOString(), quando: quando(inicio), remarcacoes: Number(d.remarcacoes) + 1 });
    } else if (mdemo[2] === "feita") {
      if (String(corpo.resumo ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["resumo"] });
      Object.assign(d, { situacao: "FEITA" });
      const i = p.interessados.find((y) => y.id === (d.interessado as Json).id);
      if (i) i.etapa = "DEMO_FEITA";
    } else {
      if (corpo.situacao === "CANCELADA" && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(d, { situacao: corpo.situacao, ...(corpo.motivo ? { motivo: corpo.motivo } : {}) });
    }
    d.versao = Number(d.versao) + 1;
    return route.fulfill({ json: d });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** A página pública do link (quadro 340), sem sessão: só dias e horas. */
export async function rotasPublicasAgenda(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json) {
  const m = /^\/v1\/publico\/agenda\/([^/]+)$/.exec(caminho);
  if (!m) return null;
  const a = p.parceiros.agenda;
  if (!/^[a-z2-9]{12}$/.test(m[1]!) || !a.links.some((l) => l.codigo === m[1])) return erro(route, 404, "NOT_FOUND");
  if (metodo === "GET") {
    const horas = ["10:00", "10:45", "11:30", "14:00", "14:45", "15:30", "16:15"];
    return route.fulfill({ json: {
      duracaoMinutos: 30, fuso: "America/Sao_Paulo",
      dias: a.dias.map((data) => ({ data, horarios: horas.map((h) => {
        // No primeiro dia, o das 16:00 é o que "acabou de ser ocupado" quando alguém tenta marcar.
        const hora = h === "16:15" && data === a.dias[0] ? "16:00" : h;
        const inicio = instante(data, hora);
        return { inicio, hora, livre: !a.ocupados.includes(inicio) };
      }) })),
      faixas: [["ATE_40", "Até 40 unidades"], ["DE_41_A_100", "41 a 100 unidades"], ["DE_101_A_200", "101 a 200 unidades"], ["DE_201_A_400", "201 a 400 unidades"],
        ["ACIMA_DE_400", "Acima de 400 unidades"]].map(([codigo, nome]) => ({ codigo, nome })),
    } });
  }
  if (metodo === "POST") {
    p.pedidos.push({ caminho, corpo });
    const campos = [
      ...(String(corpo.nome ?? "").trim().length < 2 ? ["nome"] : []), ...(String(corpo.whatsapp ?? "").replace(/\D/g, "").length < 10 ? ["whatsapp"] : []),
      ...(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(corpo.email ?? "")) ? ["email"] : []), ...(String(corpo.condominio ?? "").trim().length < 2 ? ["condominio"] : []),
      ...(corpo.consentimento !== true ? ["consentimento"] : []),
    ];
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const inicio = new Date(String(corpo.inicio)).toISOString();
    // Quem já tem demonstração (o WhatsApp e o e-mail da ficha, ou o convite): a data da que existe (0310, C).
    if (corpo.email === "ja.marcada@exemplo.com.br") {
      return route.fulfill({ status: 200, json: { jaMarcada: true, inicio: a.ocupados[0], quando: quando(a.ocupados[0]!) } });
    }
    if (inicio === a.corrida || a.ocupados.includes(inicio)) {
      a.ocupados.push(inicio);
      return erro(route, 400, "VALIDATION_ERROR", { motivo: "HORARIO_OCUPADO" });
    }
    a.ocupados.push(inicio);
    a.agendados.push({ inicio, ...corpo });
    return route.fulfill({ status: 201, json: { id: "demo-link", inicio, fim: new Date(Date.parse(inicio) + 30 * 60_000).toISOString(), quando: quando(inicio), duracaoMinutos: 30 } });
  }
  return erro(route, 404, "NOT_FOUND");
}

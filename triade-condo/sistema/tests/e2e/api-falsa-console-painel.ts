// Painel comercial, janelas do condomínio e o cartão do Início no Console falso (0309, R17.5;
// CM-10, CM-18, CM-04), ligado pelo api-falsa-console-comercial.ts: o mês atual com números
// parecidos com os do quadro 334 e os outros meses vazios; a meta que só a Administração muda; as
// janelas do Ipê Amarelo (assembleia aberta, mandato ainda não) e o Início com o Lago Sul parado.
// As regras de verdade estão no banco (pgTAP 053 e 054) e na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";
import type { ComercialConsole, PodeComercial } from "./api-falsa-console-comercial";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
const BIANCA = { id: "2d9e5b20-0000-4000-8000-00000000bb01", nome: "Bianca" };
const INDICADO = "7a1b2c3d-0000-4000-8000-0000000000a2";
const LAGO = "7a1b2c3d-0000-4000-8000-0000000000a3";
const PROPOSTA_IPE = "8b2c3d4e-0000-4000-8000-0000000000b1";

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function criarPainel(hoje: string) {
  const assembleia = somarDias(hoje, 45);
  const mandato = somarDias(hoje, 90);
  return {
    hoje,
    /** O Início sem nada pedindo atenção: o cartão some. */
    semAtencao: false,
    metas: {} as Record<string, Json & { versao: number; total: number }>,
    janelas: {
      [INDICADO]: [
        { tipo: "ASSEMBLEIA", data: assembleia, de: somarDias(assembleia, -60), ate: somarDias(assembleia, -30), situacao: "ABERTA", tratada: false, pedeAtencao: true },
        { tipo: "MANDATO", data: mandato, de: somarDias(mandato, -60), ate: mandato, situacao: "PROXIMA", tratada: false, pedeAtencao: false },
      ] as Json[],
    } as Record<string, Json[]>,
    sindicoNovo: {} as Record<string, Json>,
  };
}
export type PainelFalso = ReturnType<typeof criarPainel>;

function metaDoMes(p: PainelFalso, mes: string): Json | undefined {
  const anteriores = Object.keys(p.metas).filter((m) => m <= mes).sort();
  const m = anteriores.at(-1);
  if (!m) return undefined;
  const x = p.metas[m]!;
  return { ...x, mes: m, herdada: m !== mes, ...(m === mes ? {} : { versao: undefined }) };
}

function painel(p: PainelFalso, mes: string, pode: PodeComercial): Json {
  const atual = p.hoje.slice(0, 7);
  const cheio = mes === atual;
  const etapas = ["NOVO", "EM_CONTATO", "DEMO_MARCADA", "DEMO_FEITA", "PROPOSTA_ENVIADA", "NEGOCIACAO", "APROVACAO", "GANHO"];
  const chegaram = cheio ? [14, 11, 9, 7, 5, 4, 3, 3] : [0, 0, 0, 0, 0, 0, 0, 0];
  const meta = metaDoMes(p, mes);
  return {
    mes, mesAtual: cheio, ...(meta ? { meta } : {}), podeMudarMeta: !!pode.meta && mes >= atual, equipe: [BIANCA, CAROLINA],
    novos: chegaram[0],
    funil: etapas.map((etapa, n) => ({ etapa, chegaram: chegaram[n] })),
    porOrigem: cheio ? [{ origem: "SITE", novos: 8, ganhos: 2 }, { origem: "WHATSAPP_COMERCIAL", novos: 3, ganhos: 1 }, { origem: "INDICACAO", novos: 2, ganhos: 0 },
      { origem: "INSTAGRAM", novos: 1, ganhos: 0 }] : [],
    primeiroRetorno: cheio
      ? { total: 14, noPrazo: 10, foraDoPrazo: 4, aguardando: 1, medianaMinutosUteis: 42,
          cotacoes: { total: 2, noPrazo: 2, aguardando: 0 }, site: { total: 8, noPrazo: 8, aguardando: 1 } }
      : { total: 0, noPrazo: 0, foraDoPrazo: 0, aguardando: 0, cotacoes: { total: 0, noPrazo: 0, aguardando: 0 }, site: { total: 0, noPrazo: 0, aguardando: 0 } },
    ganhos: cheio ? { quantos: 3, novoMrr: 68700, semValor: 0, cicloMedioDias: 19 } : { quantos: 0, novoMrr: 0, semValor: 0 },
    perdas: cheio ? { quantos: 4, motivos: [{ motivo: "FICOU_PARA_DEPOIS", quantos: 2 }, { motivo: "OUTRO_SISTEMA", quantos: 1 }, { motivo: "PRECO", quantos: 1 }] }
      : { quantos: 0, motivos: [] },
    semResposta: cheio ? 2 : 0,
    porPessoa: cheio ? [{ pessoa: BIANCA, atividades: 48, ganhos: 2, novoMrr: 45800, ...(meta ? { meta: 60000 } : {}) }, { pessoa: CAROLINA, atividades: 21, ganhos: 1, novoMrr: 22900 }] : [],
    concorrentes: cheio ? [{ nome: "Planilha e WhatsApp", disputas: 6, ganhamos: 1, perdemosParaEle: 2 }, { nome: "App da administradora", disputas: 4, ganhamos: 2, perdemosParaEle: 1 }] : [],
    agora: {
      abertos: 9,
      porEtapa: [["NOVO", 2, 5], ["EM_CONTATO", 2, 10], ["DEMO_MARCADA", 1, 30], ["DEMO_FEITA", 1, 30], ["PROPOSTA_ENVIADA", 2, 50], ["NEGOCIACAO", 1, 65], ["APROVACAO", 0, 80]]
        .map(([etapa, quantos, probabilidade]) => ({ etapa, quantos, probabilidade })),
      previsao: { centavos: 91200, comValor: 5, semValor: 4 },
      parados: 1,
      atrasados: 2,
      propostasVencendo: [{ propostaId: PROPOSTA_IPE, interessadoId: INDICADO, condominio: "Edifício Ipê Amarelo", numero: 1, validoAte: somarDias(p.hoje, 3) }],
      vencendoDias: 7,
      vagasFundador: { total: 5, ocupadas: 3, livres: 2 },
    },
  };
}

function inicio(c: ComercialConsole, p: PainelFalso): Json {
  const itens: Json[] = [];
  if (!p.semAtencao) {
    itens.push({ id: LAGO, condominio: "Condomínio Lago Sul", etapa: "PROPOSTA_ENVIADA", motivo: "PARADO", meu: false, diasParado: 6, outros: 0 });
    for (const i of c.interessados) {
      const j = (p.janelas[String(i.id)] ?? []).find((x) => x.pedeAtencao);
      if (j) itens.push({ id: i.id, condominio: i.condominio, etapa: i.etapa, motivo: "JANELA", responsavel: i.responsavel, meu: true, janela: j, outros: 0 });
    }
  }
  return { total: itens.length, contagens: { primeiroRetorno: 0, atrasados: 0, parados: itens.filter((x) => x.motivo === "PARADO").length,
    janelas: itens.filter((x) => x.motivo === "JANELA").length }, itens, max: 8, podeEditar: true };
}

export async function rotasPainel(route: Route, c: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL) {
  const p = c.painel;
  const atual = p.hoje.slice(0, 7);
  if (caminho === "/v1/comercial/painel" && metodo === "GET") {
    const mes = url.searchParams.get("mes") ?? atual;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["mes"] });
    return route.fulfill({ json: painel(p, mes, pode) });
  }
  if (caminho === "/v1/comercial/painel/meta" && metodo === "PUT") {
    if (!pode.meta) return erro(route, 403, "FORBIDDEN");
    const mes = String(corpo.mes);
    if (mes < atual) return erro(route, 400, "VALIDATION_ERROR", { motivo: "META_MES_PASSADO" });
    const total = Number(corpo.total);
    if (!(total > 0)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["total"] });
    const existe = p.metas[mes];
    if ((existe?.versao ?? null) !== (corpo.versao ?? null)) return erro(route, 409, "VERSION_CONFLICT", { versao: existe?.versao });
    const equipe = [BIANCA, CAROLINA];
    const porPessoa = ((corpo.porPessoa ?? []) as { pessoaId: string; centavos: number }[])
      .map((x) => ({ pessoa: equipe.find((e) => e.id === x.pessoaId) ?? { id: x.pessoaId, nome: "?" }, centavos: x.centavos }));
    p.metas[mes] = { versao: (existe?.versao ?? 0) + 1, total, porPessoa, alteradoEm: new Date().toISOString(), alteradoPor: CAROLINA };
    return route.fulfill({ json: { mes, versao: p.metas[mes]!.versao } });
  }
  if (caminho === "/v1/comercial/inicio" && metodo === "GET") return route.fulfill({ json: inicio(c, p) });
  const m = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})\/(janelas|janelas\/tratar|sindico-novo)$/.exec(caminho);
  if (!m) return null;
  const i = c.interessados.find((x) => x.id === m[1]);
  if (!i) return erro(route, 404, "NOT_FOUND");
  const lista = (p.janelas[String(i.id)] ??= []);
  if (m[2] === "janelas" && metodo === "GET") {
    return route.fulfill({ json: { id: i.id, versao: i.versao, etapa: i.etapa, janelas: lista, ...(p.sindicoNovo[String(i.id)] ? { sindicoNovo: p.sindicoNovo[String(i.id)] } : {}),
      naoContatar: !!i.naoContatar, dias: { assembleiaDe: 60, assembleiaAte: 30, mandato: 60, fidelidade: 60 }, podeEditar: pode.editar } });
  }
  if (!pode.editar) return erro(route, 403, "FORBIDDEN");
  if (m[2] === "janelas/tratar" && metodo === "POST") {
    const j = lista.find((x) => x.tipo === corpo.tipo && x.data === corpo.data && x.situacao === "ABERTA");
    if (!j) return erro(route, 404, "NOT_FOUND");
    Object.assign(j, { tratada: true, pedeAtencao: false, tratadaEm: new Date().toISOString(), tratadaPor: CAROLINA });
    return route.fulfill({ json: { id: i.id, tipo: j.tipo, data: j.data, tratada: true } });
  }
  if (m[2] === "sindico-novo" && metodo === "POST") {
    if (corpo.versao !== i.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: i.versao });
    const desde = String(corpo.desde ?? p.hoje);
    if (corpo.mandatoAte && String(corpo.mandatoAte) <= desde) return erro(route, 400, "VALIDATION_ERROR", { campos: ["mandatoAte"] });
    i.versao = Number(i.versao) + 1;
    const lembrar = i.etapa === "PERDIDO" || i.etapa === "SEM_RESPOSTA";
    if (lembrar) lista.push({ tipo: "SINDICO_NOVO", data: desde, de: p.hoje, situacao: "ABERTA", tratada: false, pedeAtencao: true });
    if (corpo.mandatoAte) {
      const mand = lista.find((x) => x.tipo === "MANDATO");
      if (mand) Object.assign(mand, { data: corpo.mandatoAte, de: somarDias(String(corpo.mandatoAte), -60), ate: corpo.mandatoAte });
      (i.predio as Json).mandatoAte = corpo.mandatoAte;
    }
    p.sindicoNovo[String(i.id)] = { desde, registradoEm: new Date().toISOString(), registradoPor: CAROLINA };
    (i.conversas as Json[]).unshift({ id: crypto.randomUUID(), canal: "NOTA", resumo: `Síndico novo desde ${desde.split("-").reverse().join("/")}.`, respondeu: false,
      em: new Date().toISOString(), autor: CAROLINA });
    return route.fulfill({ json: { id: i.id, versao: i.versao, lembrar } });
  }
  return erro(route, 404, "NOT_FOUND");
}

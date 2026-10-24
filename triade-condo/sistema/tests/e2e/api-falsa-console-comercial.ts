// Comercial do Console falso (0296): dois interessados, um pelo site com aceite do WhatsApp e um
// por indicação sem aceite, as etapas, a equipe, as mensagens prontas e uma cadência. As regras de
// verdade estão no banco (pgTAP 045) e na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
export const SITE = "7a1b2c3d-0000-4000-8000-0000000000a1";
export const INDICADO = "7a1b2c3d-0000-4000-8000-0000000000a2";

const ETAPAS = [
  ["NOVO", 1, true, 10, 2], ["EM_CONTATO", 2, true, 20, 7], ["DEMO_MARCADA", 3, true, 35, 7], ["DEMO_FEITA", 4, true, 50, 7],
  ["PROPOSTA_ENVIADA", 5, true, 60, 10], ["NEGOCIACAO", 6, true, 75, 14], ["APROVACAO", 7, true, 85, 30],
  ["GANHO", 8, false, 100, undefined], ["PERDIDO", 9, false, 0, undefined], ["SEM_RESPOSTA", 10, false, 0, undefined],
].map(([etapa, ordem, aberta, probabilidade, limiteDias]) => ({ etapa, ordem, aberta, probabilidade, limiteDias, versao: 1 }));

export function criarComercialConsole() {
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const base = (id: string, extra: Json) => ({
    id, versao: 1, anonimizado: false, criadoEm: agora.toISOString(), etapaDesde: agora.toISOString(), objecoes: [], concorrentes: [], predio: {},
    conversas: [], etapas: [], naoContatar: false, ...extra,
  } as Json);
  return {
    interessados: [
      base(SITE, {
        condominio: "Residencial Jatobá", cidade: "Brasília", uf: "DF", faixa: "DE_41_A_100", pessoa: "Marta Alves", whatsapp: "5561999990412",
        whatsappMascarado: "(61) 9 ••••-0412", origem: "SITE", etapa: "NOVO", probabilidade: 10, temWhatsapp: true,
        primeiroRetornoAte: new Date(agora.getTime() + 3 * 3600_000).toISOString(),
        tarefa: { situacao: "HOJE", tarefa: "PRIMEIRO_RETORNO", quando: new Date(agora.getTime() + 3 * 3600_000).toISOString() }, atencao: true,
        baseLegal: { tipo: "CONSENTIMENTO", texto: "Autorizo o uso destes dados só para responder a este pedido.", em: agora.toISOString() },
        optin: { em: agora.toISOString(), canal: "SITE", texto: "Aceitou receber mensagens pelo WhatsApp comercial" },
        cadencia: { id: "c1", nome: "Novo pelo site", passos: [{ dia: 0, canal: "WHATSAPP", texto: "Primeira mensagem" }, { dia: 2, canal: "LIGACAO", texto: "Ligar" }],
          feitos: 0, inicio: agora.toISOString() },
      }),
      base(INDICADO, {
        condominio: "Edifício Ipê Amarelo", cidade: "Taguatinga", uf: "DF", pessoa: "João Reis", whatsapp: "5561988880000", whatsappMascarado: "(61) 9 ••••-0000",
        origem: "INDICACAO", origemDetalhe: "Síndica do Jatobá", etapa: "EM_CONTATO", probabilidade: 20, temWhatsapp: false, responsavel: CAROLINA,
        proximoPasso: { texto: "Ligar para marcar a demonstração", data: hoje },
        tarefa: { situacao: "HOJE", tarefa: "PROXIMO_PASSO", quando: hoje }, atencao: false,
        baseLegal: { tipo: "LEGITIMO_INTERESSE", texto: "A pessoa procurou a TRÍADE ou aceitou o contato.", em: agora.toISOString() },
      }),
    ] as Json[],
    mensagens: [
      { id: "m1", etapa: "NOVO", titulo: "Primeira resposta", texto: "Olá, [nome]! Recebemos o pedido do [condominio].", ativa: true, versao: 1 },
      { id: "m2", etapa: "EM_CONTATO", titulo: "Marcar demonstração", texto: "Oi, [nome], que dia fica bom para a demonstração?", ativa: true, versao: 1 },
    ] as Json[],
    cadencias: [{ id: "c1", nome: "Novo pelo site", gatilho: "NOVO", origem: "SITE", passos: [{ dia: 0, canal: "WHATSAPP", texto: "Primeira mensagem" }],
      terminaSemResposta: false, ativa: true, versao: 1, emUso: 1 }] as Json[],
    /** O que a tela mandou, para o teste conferir. */
    pedidos: [] as { caminho: string; corpo: Json }[],
  };
}

export type ComercialConsole = ReturnType<typeof criarComercialConsole>;

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });

const LISTA = ["id", "versao", "condominio", "cidade", "uf", "faixa", "pessoa", "whatsappMascarado", "origem", "origemDetalhe", "etapa", "etapaDesde", "probabilidade",
  "responsavel", "proximoPasso", "primeiroRetornoAte", "anonimizado", "criadoEm", "tarefa", "atencao", "temWhatsapp"];
const resumo = (i: Json) => Object.fromEntries(LISTA.filter((k) => i[k] !== undefined).map((k) => [k, i[k]]));

export async function rotasComercialConsole(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json, admin: boolean) {
  if (!caminho.startsWith("/v1/comercial")) return null;
  if (!admin) return erro(route, 403, "FORBIDDEN");
  if (metodo !== "GET") p.pedidos.push({ caminho, corpo });
  const equipe = [CAROLINA];
  if (caminho === "/v1/comercial/interessados" && metodo === "GET") {
    const abertos = p.interessados.filter((i) => ETAPAS.find((e) => e.etapa === i.etapa)?.aberta);
    return route.fulfill({ json: { interessados: p.interessados.map(resumo), etapas: ETAPAS, equipe, podeEditar: true, podeExportar: true,
      contagens: { atencao: abertos.filter((i) => i.atencao).length, abertos: abertos.length, porEtapa: {} } } });
  }
  if (caminho === "/v1/comercial/meu-dia") {
    return route.fulfill({ json: { atrasados: [], hoje: p.interessados.filter((i) => (i.tarefa as Json).situacao === "HOJE").map(resumo), semPasso: [], equipe, podeEditar: true } });
  }
  if (caminho === "/v1/comercial/interessados" && metodo === "POST") {
    const igual = p.interessados.find((i) => i.whatsapp && String(corpo.whatsapp ?? "").replace(/\D/g, "").endsWith(String(i.whatsapp).slice(2)));
    if (igual) return route.fulfill({ status: 201, json: { id: igual.id, juntado: true } });
    if (!corpo.contatoAceito) return erro(route, 400, "VALIDATION_ERROR", { campos: ["contatoAceito"] });
    return route.fulfill({ status: 201, json: { id: INDICADO, juntado: false } });
  }
  if (caminho === "/v1/comercial/modelos") {
    return route.fulfill({ json: { mensagens: p.mensagens, cadencias: p.cadencias, objecoes: [], etapas: ETAPAS, podeEditar: true } });
  }
  const m = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})(\/.*)?$/.exec(caminho);
  const i = m ? p.interessados.find((x) => x.id === m[1]) : undefined;
  if (m && !i) return erro(route, 404, "NOT_FOUND");
  if (i && !m![2] && metodo === "GET") {
    return route.fulfill({ json: { ...i, mensagens: p.mensagens.filter((x) => x.etapa === i.etapa), objecoesLista: [
      { codigo: "PRECO", texto: "Achou caro", resposta: "Mostre o preço por unidade." }], etapasLista: ETAPAS, equipe, podeEditar: true, podeExcluir: true } });
  }
  if (i && m![2] === "/etapa") {
    if (corpo.etapa === "DEMO_MARCADA" && !(i.predio as Json).demonstracaoEm) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FALTA_PARA_ETAPA", campos: ["demonstracaoEm"] });
    i.etapa = corpo.etapa;
    i.versao = Number(i.versao) + 1;
    return route.fulfill({ json: { id: i.id, versao: i.versao } });
  }
  if (i && m![2] === "/conversas") {
    (i.conversas as Json[]).unshift({ id: crypto.randomUUID(), canal: corpo.canal, resumo: corpo.resumo, respondeu: !!corpo.respondeu, em: new Date().toISOString(), autor: CAROLINA });
    return route.fulfill({ status: 201, json: { id: "x" } });
  }
  if (i && m![2] === "/cadencia") {
    const c = i.cadencia as Json;
    c.feitos = Number(c.feitos) + 1;
    return route.fulfill({ json: { ok: true } });
  }
  return erro(route, 404, "NOT_FOUND");
}

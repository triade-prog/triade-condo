// Comercial do Console falso (0296 e 0304): três interessados (um pelo site com aceite do WhatsApp,
// um por indicação sem aceite e um com a proposta vencida), as etapas, a equipe, as mensagens
// prontas e uma cadência; e as propostas (R17.3): a sugestão pela tabela, as versões, o desconto
// que só a Administração aprova, o envio com o link, o kit, as respostas prontas, as referências e
// as rotas públicas do link com o aceite; e o kit pelos critérios do síndico (0307), com os fatos
// que a equipe confirmou de cada sistema. As regras de verdade estão no banco (pgTAP 045 e 046) e
// na API (Deno); aqui se confere a tela.
import type { Route } from "@playwright/test";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
export const SITE = "7a1b2c3d-0000-4000-8000-0000000000a1";
export const INDICADO = "7a1b2c3d-0000-4000-8000-0000000000a2";
export const LAGO = "7a1b2c3d-0000-4000-8000-0000000000a3";
export const PROPOSTA_IPE = "8b2c3d4e-0000-4000-8000-0000000000b1";
export const PROPOSTA_LAGO = "8b2c3d4e-0000-4000-8000-0000000000b2";
/** Os códigos dos links que já existem: a proposta enviada do Ipê e a vencida do Lago Sul. */
export const CODIGO_IPE = "codigo-do-link-ipe-amarelo-0123456789";
export const CODIGO_VENCIDO = "codigo-do-link-lago-sul-vencido-0123";

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
        condominio: "Residencial Jatobá", cidade: "Brasília", uf: "DF", faixa: "DE_41_A_100", unidades: 72, pessoa: "Marta Alves", whatsapp: "5561999990412",
        whatsappMascarado: "(61) 9 ••••-0412", origem: "SITE", etapa: "NOVO", probabilidade: 10, temWhatsapp: true,
        primeiroRetornoAte: new Date(agora.getTime() + 3 * 3600_000).toISOString(),
        tarefa: { situacao: "HOJE", tarefa: "PRIMEIRO_RETORNO", quando: new Date(agora.getTime() + 3 * 3600_000).toISOString() }, atencao: true,
        baseLegal: { tipo: "CONSENTIMENTO", texto: "Autorizo o uso destes dados só para responder a este pedido.", em: agora.toISOString() },
        optin: { em: agora.toISOString(), canal: "SITE", texto: "Aceitou receber mensagens pelo WhatsApp comercial" },
        cadencia: { id: "c1", nome: "Novo pelo site", passos: [{ dia: 0, canal: "WHATSAPP", texto: "Primeira mensagem" }, { dia: 2, canal: "LIGACAO", texto: "Ligar" }],
          feitos: 0, inicio: agora.toISOString() },
      }),
      base(INDICADO, {
        condominio: "Edifício Ipê Amarelo", cidade: "Taguatinga", uf: "DF", faixa: "ATE_40", unidades: 32, pessoa: "João Reis", whatsapp: "5561988880000", whatsappMascarado: "(61) 9 ••••-0000",
        origem: "INDICACAO", origemDetalhe: "Síndica do Jatobá", etapa: "EM_CONTATO", probabilidade: 20, temWhatsapp: false, responsavel: CAROLINA,
        proximoPasso: { texto: "Ligar para marcar a demonstração", data: hoje },
        tarefa: { situacao: "HOJE", tarefa: "PROXIMO_PASSO", quando: hoje }, atencao: false,
        baseLegal: { tipo: "LEGITIMO_INTERESSE", texto: "A pessoa procurou a TRÍADE ou aceitou o contato.", em: agora.toISOString() },
        predio: { sistemaAtual: "Planilha e WhatsApp", decisaoEm: somarDias(hoje, 20), criterios: ["CUSTO_APARTAMENTO", "COMO_CANCELAR"],
          problema: "Pedidos de manutenção somem no grupo do WhatsApp" }, concorrentes: [{ nome: "CondoApp", preco: 28800 }, { nome: "Outro App" }],
      }),
      base(LAGO, {
        condominio: "Condomínio Lago Sul", cidade: "Brasília", uf: "DF", faixa: "DE_101_A_200", unidades: 150, pessoa: "Rita Gomes", origem: "INSTAGRAM", etapa: "PROPOSTA_ENVIADA",
        probabilidade: 60, temWhatsapp: false, tarefa: { situacao: "FUTURO" }, atencao: false,
        baseLegal: { tipo: "CONSENTIMENTO", texto: "Autorizo o uso destes dados só para responder a este pedido.", em: agora.toISOString() },
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
    /** Os fatos do comparativo (0307): a fonte é só da equipe. */
    fatos: [] as Json[],
    ...criarPropostas(hoje),
  };
}

const CAROLINA_REF = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
const BIANCA = { id: "2d9e5b20-0000-4000-8000-00000000bb01", nome: "Bianca" };
const HASH_IPE = "5d1f".padEnd(64, "c");
const OFERTA = {
  incluido: ["Todo pedido com responsável, prazo e conclusão explicada", "Comunicados, documentos e mural do prédio por link", "Agenda, manutenção e prestadores"],
  planejado: ["WhatsApp oficial", "Inteligência artificial"],
};
/** A Tabela de preços falsa, em centavos. Acima de 400 unidades, sob consulta. */
const FAIXAS: [string, string, number, number | null, { fundador: number; cheia: number; implantacao: number } | null][] = [
  ["ATE_40", "Até 40 unidades", 1, 40, { fundador: 12900, cheia: 19900, implantacao: 60000 }],
  ["DE_41_A_100", "41 a 100 unidades", 41, 100, { fundador: 22900, cheia: 32900, implantacao: 90000 }],
  ["DE_101_A_200", "101 a 200 unidades", 101, 200, { fundador: 32900, cheia: 44900, implantacao: 120000 }],
  ["DE_201_A_400", "201 a 400 unidades", 201, 400, { fundador: 44900, cheia: 59900, implantacao: 150000 }],
  ["ACIMA_DE_400", "Acima de 400 unidades", 401, null, null],
];

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function criarPropostas(hoje: string) {
  const agora = new Date().toISOString();
  const versao = (extra: Json): Json => ({
    versaoRegistro: 1, ciclo: "MENSAL", moeda: "BRL", incluido: OFERTA.incluido, planejado: OFERTA.planejado, respostas: [], referencias: [], validadeDias: 15,
    criadoEm: agora, criadoPor: BIANCA, descontoSituacao: "SEM", aberturas: { total: 0, aparelhos: 0 }, ...extra,
  });
  return {
    respostas: [
      { id: "9c3d4e5f-0000-4000-8000-0000000000c1", tema: "LGPD", titulo: "Quem controla os dados", texto: "O condomínio controla os dados; a TRÍADE trata só para o atendimento.",
        ativa: true, revisada: true, revisadaEm: agora, revisadaPor: CAROLINA_REF, versao: 1 },
      { id: "9c3d4e5f-0000-4000-8000-0000000000c2", tema: "CANCELAMENTO", titulo: "Como cancelar", texto: "Aviso com 30 dias, sem multa, e os dados voltam em planilha.",
        ativa: true, revisada: true, revisadaEm: agora, revisadaPor: CAROLINA_REF, versao: 1 },
      { id: "9c3d4e5f-0000-4000-8000-0000000000c3", tema: "SUPORTE", titulo: "Como pedir ajuda", texto: "Pelo WhatsApp comercial, em dias úteis.", ativa: true, revisada: false, versao: 1 },
    ] as Json[],
    referencias: [
      { id: "aa4e5f60-0000-4000-8000-0000000000d1", sindico: "Paulo Dias", condominio: "Edifício Aroeira", unidades: 64, escopo: "CONTATO", whatsapp: "5561988887777",
        autorizadoEm: somarDias(hoje, -5), autorizacaoTexto: "Autorizou por WhatsApp na semana passada", emUso: 1, versao: 1 },
      { id: "aa4e5f60-0000-4000-8000-0000000000d2", sindico: "Ana Lima", condominio: "Ed. Buriti", escopo: "SO_NOME", autorizadoEm: somarDias(hoje, -40),
        autorizacaoTexto: "Autorizou em reunião do conselho", retirada: { em: agora, motivo: "Pediu por telefone", por: CAROLINA_REF }, emUso: 0, versao: 2 },
    ] as Json[],
    propostas: [
      { id: PROPOSTA_IPE, interessadoId: INDICADO, versao: 2, criadoEm: agora, versoes: [versao({
        id: "8b2c3d4e-0000-4000-8000-0000000000e1", versaoRegistro: 4, numero: 1, situacao: "ENVIADA", condominio: "Edifício Ipê Amarelo", cidade: "Taguatinga", uf: "DF",
        faixa: "ATE_40", unidades: 32, tabela: "FUNDADOR", mensalTabela: 12900, mensal: 12900, depoisFundador: 19900, fundadorMeses: 12, implantacaoSemCusto: true,
        porApartamento: 403, validoAte: somarDias(hoje, 10), hash: HASH_IPE, enviadaEm: agora, enviadaPor: BIANCA,
        respostas: [{ id: "9c3d4e5f-0000-4000-8000-0000000000c1", tema: "LGPD", titulo: "Quem controla os dados", texto: "O condomínio controla os dados; a TRÍADE trata só para o atendimento." }],
        referencias: [{ id: "aa4e5f60-0000-4000-8000-0000000000d1", sindico: "Paulo Dias", condominio: "Edifício Aroeira", unidades: 64, escopo: "CONTATO", whatsapp: "5561988887777" }],
        notaInterna: "NOTA INTERNA: o síndico quer fechar antes da assembleia",
        link: { ativo: true, criadoEm: agora, expiraEm: `${somarDias(hoje, 11)}T00:00:00-03:00` }, aberturas: { total: 4, aparelhos: 3, ultima: agora },
      })] },
      { id: PROPOSTA_LAGO, interessadoId: LAGO, versao: 2, criadoEm: agora, versoes: [versao({
        id: "8b2c3d4e-0000-4000-8000-0000000000e2", versaoRegistro: 3, numero: 1, situacao: "VENCIDA", condominio: "Condomínio Lago Sul", cidade: "Brasília", uf: "DF",
        faixa: "DE_101_A_200", unidades: 150, tabela: "CHEIA", mensalTabela: 44900, mensal: 44900, implantacao: 120000, implantacaoParcelas: 3, implantacaoSemCusto: false,
        porApartamento: 299, validoAte: somarDias(hoje, -7), hash: "77ab".padEnd(64, "0"), enviadaEm: agora, enviadaPor: BIANCA,
        link: { ativo: true, criadoEm: agora, expiraEm: `${somarDias(hoje, -6)}T00:00:00-03:00` }, aberturas: { total: 1, aparelhos: 1, ultima: agora },
      })] },
    ] as Json[],
    /** Código do link → a versão. Só o resumo fica no banco de verdade; aqui, o código. */
    links: { [CODIGO_IPE]: { propostaId: PROPOSTA_IPE, versaoId: "8b2c3d4e-0000-4000-8000-0000000000e1" },
             [CODIGO_VENCIDO]: { propostaId: PROPOSTA_LAGO, versaoId: "8b2c3d4e-0000-4000-8000-0000000000e2" } } as Record<string, { propostaId: string; versaoId: string }>,
    vagas: { total: 5, ocupadas: 2 },
    hoje,
  };
}

export type ComercialConsole = ReturnType<typeof criarComercialConsole>;

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });

const LISTA = ["id", "versao", "condominio", "cidade", "uf", "faixa", "pessoa", "whatsappMascarado", "origem", "origemDetalhe", "etapa", "etapaDesde", "probabilidade",
  "responsavel", "proximoPasso", "primeiroRetornoAte", "anonimizado", "criadoEm", "tarefa", "atencao", "temWhatsapp"];
const resumo = (i: Json) => Object.fromEntries(LISTA.filter((k) => i[k] !== undefined).map((k) => [k, i[k]]));

/** O que a pessoa pode no Comercial: a Administração tudo; o Comercial sem aprovar desconto e sem mudar modelos. */
export interface PodeComercial { ver: boolean; editar: boolean; desconto: boolean; modelos: boolean }

export async function rotasComercialConsole(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL) {
  if (!caminho.startsWith("/v1/comercial")) return null;
  if (!pode.ver) return erro(route, 403, "FORBIDDEN");
  if (metodo !== "GET") p.pedidos.push({ caminho, corpo });
  if (/^\/v1\/comercial\/(propostas|respostas|referencias|fatos)/.test(caminho)) return rotasPropostas(route, p, caminho, metodo, corpo, pode, url);
  if (metodo !== "GET" && !pode.editar) return erro(route, 403, "FORBIDDEN");
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
    return route.fulfill({ json: { mensagens: p.mensagens, cadencias: p.cadencias, objecoes: [], etapas: ETAPAS, podeEditar: pode.modelos } });
  }
  const m = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})(\/.*)?$/.exec(caminho);
  const i = m ? p.interessados.find((x) => x.id === m[1]) : undefined;
  if (m && !i) return erro(route, 404, "NOT_FOUND");
  if (i && !m![2] && metodo === "GET") {
    return route.fulfill({ json: { ...i, mensagens: p.mensagens.filter((x) => x.etapa === i.etapa), objecoesLista: [
      { codigo: "PRECO", texto: "Achou caro", resposta: "Mostre o preço por unidade." }], etapasLista: ETAPAS, equipe, podeEditar: pode.editar, podeExcluir: pode.modelos } });
  }
  if (i && m![2] === "/criterios" && metodo === "PUT") {
    if (corpo.versao !== i.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: i.versao });
    const marcados = CRITERIOS.map((c) => c[0]).filter((c) => ((corpo.criterios ?? []) as string[]).includes(c));
    const outro = String(corpo.criterioOutro ?? "").trim();
    if (marcados.includes("OUTRO") && outro.length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["criterioOutro"] });
    if (String(corpo.problema ?? "").length > 300) return erro(route, 400, "VALIDATION_ERROR", { campos: ["problema"] });
    Object.assign(i.predio as Json, { criterios: marcados, criterioOutro: marcados.includes("OUTRO") ? outro : undefined, problema: String(corpo.problema ?? "").trim() || undefined });
    i.versao = Number(i.versao) + 1;
    return route.fulfill({ json: { id: i.id, versao: i.versao } });
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

// ---------------------------------------------------------------------------------------------
// Propostas (0304). A conta do preço imita a sugestão do banco só para a tela ter números.

type Proposta = Json & { id: string; interessadoId: string; versao: number; versoes: Json[] };
const semInternos = (o: Json) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
const vencida = (v: Json, hoje: string) => v.situacao === "VENCIDA" || (v.situacao === "ENVIADA" && typeof v.validoAte === "string" && v.validoAte < hoje);
const situacaoDe = (v: Json, hoje: string) => (vencida(v, hoje) ? "VENCIDA" : String(v.situacao));
const ABA: Record<string, string> = { RASCUNHO: "EM_ABERTO", PRONTA: "EM_ABERTO", ENVIADA: "EM_ABERTO", AGUARDA_DESCONTO: "AGUARDANDO_APROVACAO", ACEITA: "ACEITAS",
  VENCIDA: "VENCIDAS", RECUSADA: "RECUSADAS" };

function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => { let t = 0; for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

function sugerir(p: ComercialConsole, i: Json, c: Json): Json {
  const proposta = p.propostas.find((x) => x.interessadoId === i.id) as Proposta | undefined;
  const livres = p.vagas.total - p.vagas.ocupadas;
  const comum = {
    validadeDias: 15, validoAtePrevisto: somarDias(p.hoje, 15), vagasFundador: { ...p.vagas, livres }, tabelaEmUso: "FUNDADOR", oferta: OFERTA,
    interessado: { id: i.id, condominio: i.condominio, unidades: i.unidades, faixa: i.faixa, pessoa: i.pessoa, etapa: i.etapa }, propostaId: proposta?.id ?? null,
    respostas: p.respostas.filter((r) => r.revisada && r.ativa).map((r) => ({ id: r.id, tema: r.tema, titulo: r.titulo })),
    referencias: p.referencias.filter((r) => !r.retirada).map((r) => ({ id: r.id, sindico: r.sindico, condominio: r.condominio, unidades: r.unidades, escopo: r.escopo })),
  };
  const ciclo = c.ciclo === "ANUAL" ? "ANUAL" : "MENSAL";
  const unidades = (c.unidades as number | null) ?? (i.unidades as number | undefined) ?? null;
  if (!unidades) return { ciclo, avisos: ["SEM_UNIDADES"], ...comum };
  const [codigo, nome, de, ate, valores] = FAIXAS.find(([, , d, a]) => unidades >= d && (a === null || unidades <= a))!;
  const faixa = { codigo, nome, unidadesDe: de, ...(ate ? { unidadesAte: ate } : {}) };
  const avisos: string[] = [];
  const desconto = typeof c.desconto === "number" ? c.desconto : null;
  const comDesconto = (m: number) => (desconto ? Math.round((m * (100 - desconto)) / 100) : m);
  if (!valores) {
    avisos.push("SOB_CONSULTA");
    const mt = typeof c.valorManual === "number" ? c.valorManual : undefined;
    const mensal = mt !== undefined ? comDesconto(mt) : undefined;
    return { unidades, faixa, ciclo, tabela: "MANUAL", mensalTabela: mt, mensal, desconto: desconto ?? undefined, avisos, implantacaoSemCusto: ciclo === "ANUAL",
      ...(typeof c.implantacaoManual === "number" && ciclo === "MENSAL" ? { implantacao: c.implantacaoManual } : {}),
      ...(mensal ? { porApartamento: Math.max(Math.round(mensal / unidades), 1) } : {}), ...(ciclo === "ANUAL" && mensal ? { anual: mensal * 11, mesesPagos: 11 } : {}), ...comum };
  }
  let tabela = c.tabela === "CHEIA" ? "CHEIA" : "FUNDADOR";
  if (tabela === "FUNDADOR" && ciclo === "ANUAL") { tabela = "CHEIA"; if (c.tabela === "FUNDADOR") avisos.push("FUNDADOR_SO_MENSAL"); }
  if (tabela === "FUNDADOR" && livres <= 0) { tabela = "CHEIA"; avisos.push("SEM_VAGA_FUNDADOR"); }
  const mensalTabela = tabela === "FUNDADOR" ? valores.fundador : valores.cheia;
  const mensal = comDesconto(mensalTabela);
  return {
    unidades, faixa, ciclo, tabela, mensalTabela, mensal, desconto: desconto ?? undefined, porApartamento: Math.max(Math.round(mensal / unidades), 1), avisos,
    ...(tabela === "FUNDADOR" ? { depoisFundador: valores.cheia, fundadorMeses: 12, implantacaoSemCusto: true }
      : ciclo === "ANUAL" ? { implantacaoSemCusto: true } : { implantacao: valores.implantacao, implantacaoParcelas: 3, implantacaoSemCusto: false }),
    ...(ciclo === "ANUAL" ? { anual: mensal * 11, mesesPagos: 11 } : {}),
    ...comum,
  };
}

/** Os campos da versão a partir do corpo (camposVersao): o preço sai da "tabela", nunca da tela. */
function montarVersao(p: ComercialConsole, i: Json, c: Json, extra: Json): Json | { campos: string[] } {
  const campos: string[] = [];
  const unidades = (c.unidades as number | null) ?? (i.unidades as number | undefined);
  if (!unidades) campos.push("unidades");
  if (c.desconto && !c.descontoMotivo) campos.push("descontoMotivo");
  if (c.valorManual && !c.valorManualMotivo) campos.push("valorManualMotivo");
  if (campos.length) return { campos };
  const s = sugerir(p, i, c);
  const resp = p.respostas.filter((r) => (c.respostas as string[] ?? []).includes(String(r.id)) && r.revisada && r.ativa);
  const refs = p.referencias.filter((r) => (c.referencias as string[] ?? []).includes(String(r.id)) && !r.retirada);
  return {
    condominio: i.condominio, cidade: i.cidade, uf: i.uf, faixa: (s.faixa as Json | undefined)?.codigo, unidades, ciclo: s.ciclo, tabela: s.tabela, moeda: "BRL",
    mensalTabela: s.mensalTabela, mensal: s.mensal, anual: s.anual, mesesPagos: s.mesesPagos, depoisFundador: s.depoisFundador, fundadorMeses: s.fundadorMeses,
    implantacaoSemCusto: s.implantacaoSemCusto, implantacao: s.implantacao, implantacaoParcelas: s.implantacaoParcelas, porApartamento: s.porApartamento,
    incluido: OFERTA.incluido, planejado: OFERTA.planejado,
    respostas: resp.map((r) => ({ id: r.id, tema: r.tema, titulo: r.titulo, texto: r.texto, revisadaEm: r.revisadaEm })),
    referencias: refs.map((r) => ({ id: r.id, sindico: r.sindico, condominio: r.condominio, unidades: r.unidades, escopo: r.escopo, whatsapp: r.whatsapp, retirada: false })),
    validadeDias: (c.validadeDias as number | null) ?? 15, notaInterna: c.notaInterna ?? undefined, valorManualMotivo: c.valorManualMotivo ?? undefined,
    descontoSituacao: "SEM", _pct: c.desconto ?? null, _motivo: c.descontoMotivo ?? null, aberturas: { total: 0, aparelhos: 0 },
    pedeAprovacao: !!c.desconto || s.tabela === "MANUAL",
    criadoEm: new Date().toISOString(), criadoPor: BIANCA, ...extra,
  };
}

function itemLista(p: ComercialConsole, x: Proposta): Json {
  const i = (p.interessados.find((y) => y.id === x.interessadoId) ?? {}) as Json;
  const v = x.versoes[0]!;
  const sit = situacaoDe(v, p.hoje);
  return {
    id: x.id, versao: x.versao, aba: ABA[sit] ?? "EM_ABERTO",
    interessado: { id: i.id, condominio: i.condominio, etapa: i.etapa, ...(i.responsavel ? { responsavel: i.responsavel } : {}) },
    atual: { id: v.id, numero: v.numero, situacao: sit, ciclo: v.ciclo, tabela: v.tabela, mensal: v.mensal, validoAte: v.validoAte, enviadaEm: v.enviadaEm,
      descontoSituacao: v.descontoSituacao, ...(v.descontoSituacao === "APROVADO" ? { desconto: v._pct } : {}) },
    aberturas: v.aberturas, ...(v.aceite ? { aceite: { em: (v.aceite as Json).em, cargo: (v.aceite as Json).cargo } } : {}),
  };
}

function versaoParaTela(v: Json, hoje: string): Json {
  return semInternos({ ...v, situacao: situacaoDe(v, hoje), versao: v.numero, ...(v.descontoSituacao === "APROVADO" ? { desconto: v._pct } : {}) });
}

/** O que o link mostra (4.1): nada interno. */
function propostaPublica(p: ComercialConsole, x: Proposta, v: Json): Json {
  const i = p.interessados.find((y) => y.id === x.interessadoId) ?? {};
  const pegar = ["numero", "condominio", "cidade", "uf", "faixa", "unidades", "ciclo", "tabela", "moeda", "mensalTabela", "mensal", "anual", "mesesPagos", "depoisFundador",
    "fundadorMeses", "implantacaoSemCusto", "implantacao", "implantacaoParcelas", "porApartamento", "incluido", "planejado", "validadeDias", "validoAte", "hash", "enviadaEm"];
  const aceite = v.aceite as Json | undefined;
  return {
    ...Object.fromEntries(pegar.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])), versao: v.numero, situacao: situacaoDe(v, p.hoje),
    ...(v.descontoSituacao === "APROVADO" ? { desconto: v._pct } : {}),
    respostas: (v.respostas as Json[]).map((r) => ({ tema: r.tema, titulo: r.titulo, texto: r.texto })),
    referencias: (v.referencias as Json[]).filter((r) => !p.referencias.find((y) => y.id === r.id)?.retirada),
    aosCuidados: (i as Json).pessoa, podeAceitar: v.situacao === "ENVIADA" && !vencida(v, p.hoje), kitDisponivel: true,
    ...(aceite ? { aceite: { nome: aceite.nome, cargo: aceite.cargo, em: aceite.em, numero: v.numero, hash: v.hash } } : {}),
  };
}

/** A lista fechada dos critérios do síndico e o texto fixo da TRÍADE (comercial_criterios, 0307). */
const CRITERIOS: [string, string, string | null][] = [
  ["PEDIDO_COM_PRAZO", "Todo pedido com responsável e prazo", "Sim: todo pedido tem responsável, prazo e conclusão explicada"],
  ["SEM_BAIXAR_APP", "Morador usa sem baixar app", "Sim: comunicados, documentos e mural do prédio abrem por link, sem baixar app; o WhatsApp oficial ainda é planejado"],
  ["HISTORICO_PASSA", "Histórico que passa para o próximo síndico", "Sim: o histórico fica com o prédio e passa ao próximo síndico com o dossiê de passagem de bastão"],
  ["CUSTO_APARTAMENTO", "Custo por apartamento por mês", null],
  ["COMO_CANCELAR", "Como cancelar", "A TRÍADE propõe aviso de 30 dias, sem multa; vale o que estiver no contrato assinado"],
  ["DEVOLUCAO_DADOS", "Devolução dos dados na saída", "Sim: o síndico exporta todo o histórico do prédio pela Plataforma, quando quiser"],
  ["OUTRO", "Outro", "A equipe da TRÍADE responde este ponto com o conselho"],
];
const chave = (t: unknown) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const reais = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100).replace(/\u00a0/g, " ");

function comparativoPorCriterios(p: ComercialConsole, i: Json, v: Json): Json {
  const predio = (i.predio ?? {}) as Json;
  const colunas: Json[] = [];
  const junta = (nome: unknown, tipo: string) => { if (nome && !colunas.some((c) => chave(c.nome) === chave(nome))) colunas.push({ nome, tipo }); };
  junta(predio.sistemaAtual, "SISTEMA_ATUAL");
  for (const c of (i.concorrentes ?? []) as Json[]) junta(c.nome, "CONCORRENTE");
  const marcados = (predio.criterios ?? []) as string[];
  const linhas = CRITERIOS.filter(([c]) => marcados.includes(c)).map(([criterio, titulo, triade]) => ({
    criterio, titulo: criterio === "OUTRO" ? predio.criterioOutro ?? titulo : titulo,
    triade: triade ?? `${reais(Number(v.porApartamento))} por apartamento por mês (estimativa), ${v.implantacaoSemCusto ? "sem custo de implantação" : "implantação à parte"}`,
    valores: colunas.map((col) => {
      const f = p.fatos.find((y) => !y.retiradoEm && y.criterio === criterio && chave(y.sistema) === chave(col.nome) && (criterio !== "OUTRO" || y.interessadoId === i.id));
      if (f) return { confirmado: true, texto: f.texto };
      const c = ((i.concorrentes ?? []) as Json[]).find((y) => chave(y.nome) === chave(col.nome));
      if (criterio === "CUSTO_APARTAMENTO" && c?.preco) {
        return { confirmado: true, texto: `${reais(Math.round(Number(c.preco) / Number(i.unidades ?? 1)))} por apartamento (Básico: ${reais(Number(c.preco))} por mês)` };
      }
      return { confirmado: false };
    }),
  }));
  return { colunas, linhas };
}

function kitDe(p: ComercialConsole, x: Proposta, v: Json): Json {
  const i = (p.interessados.find((y) => y.id === x.interessadoId) ?? {}) as Json;
  const predio = (i.predio ?? {}) as Json;
  const pub = propostaPublica(p, x, v);
  delete pub.aosCuidados; delete pub.podeAceitar; delete pub.aceite;
  const sistemas = comparativoPorCriterios(p, i, v).colunas as Json[];
  return {
    propostaId: x.id, versaoId: v.id, proposta: pub,
    predio: { condominio: i.condominio, cidade: i.cidade, uf: i.uf, unidades: i.unidades, ...predio },
    interessado: { id: i.id, versao: i.versao }, podeEditar: true,
    fatos: p.fatos.filter((f) => !f.retiradoEm && sistemas.some((c) => chave(c.nome) === chave(f.sistema)) && (f.criterio !== "OUTRO" || f.interessadoId === i.id))
      .map((f) => ({ id: f.id, versao: f.versao, sistema: f.sistema, criterio: f.criterio, texto: f.texto, fonte: f.fonte, confirmadoEm: f.confirmadoEm })),
    comparativo: {
      ...comparativoPorCriterios(p, i, v),
      triade: { ciclo: v.ciclo, mensal: v.mensal, porApartamento: v.porApartamento, implantacaoSemCusto: v.implantacaoSemCusto, estimativa: true },
      ...(predio.sistemaAtual ? { sistemaAtual: { nome: predio.sistemaAtual, fidelidadeAte: predio.fidelidadeAte } } : {}),
      concorrentes: ((i.concorrentes ?? []) as Json[]).map((c) => c.preco
        ? { nome: c.nome, confirmado: true, planos: [{ plano: "Básico", modelo: "POR_UNIDADE", preco: c.preco, porApartamento: Math.round(Number(c.preco) / Number(i.unidades ?? 1)), fonte: "site", lidoEm: p.hoje }] }
        : { nome: c.nome, confirmado: false, planos: [] }),
    },
    respostas: (v.respostas as Json[]).map((r) => ({ tema: r.tema, titulo: r.titulo, texto: r.texto })),
    referencias: pub.referencias, oferta: OFERTA,
    respostasDisponiveis: p.respostas.filter((r) => r.revisada && r.ativa).map((r) => ({ id: r.id, tema: r.tema, titulo: r.titulo })),
  };
}

let sequencia = 0;
const novoId = (prefixo: string) => `${prefixo}-0000-4000-8000-${String(++sequencia).padStart(12, "0")}`;
const novoCodigo = () => `link-novo-${String(++sequencia).padStart(4, "0")}-abcdefghijklmnopqrstuvwxyz`;

function gerarLink(p: ComercialConsole, x: Proposta, v: Json) {
  for (const [k, l] of Object.entries(p.links)) if (l.versaoId === v.id) delete p.links[k];
  const codigo = novoCodigo();
  p.links[codigo] = { propostaId: x.id, versaoId: String(v.id) };
  const expiraEm = `${somarDias(String(v.validoAte), 1)}T00:00:00-03:00`;
  v.link = { ativo: true, criadoEm: new Date().toISOString(), expiraEm };
  return { codigo, expiraEm };
}

async function rotasPropostas(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL) {
  const escreve = metodo !== "GET";
  // Respostas prontas e referências (CM-27, CM-28): só a Administração muda.
  if (caminho === "/v1/comercial/respostas" && !escreve) return route.fulfill({ json: { respostas: p.respostas, podeEditar: pode.modelos } });
  if (caminho === "/v1/comercial/referencias" && !escreve) {
    return route.fulfill({ json: { referencias: [...p.referencias].sort((a, b) => Number(!!a.retirada) - Number(!!b.retirada)), podeEditar: pode.modelos } });
  }
  const mr = /^\/v1\/comercial\/(respostas|referencias)(?:\/([0-9a-f-]{36}))?(\/retirar)?$/.exec(caminho);
  if (mr) {
    if (!pode.modelos) return erro(route, 403, "FORBIDDEN");
    const lista = mr[1] === "respostas" ? p.respostas : p.referencias;
    const atual = mr[2] ? lista.find((x) => x.id === mr[2]) : undefined;
    if (mr[2] && !atual) return erro(route, 404, "NOT_FOUND");
    if (atual && corpo.versao !== atual.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: atual.versao, atual });
    if (mr[3]) {
      if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(atual!, { retirada: { em: new Date().toISOString(), motivo: corpo.motivo, por: CAROLINA_REF }, whatsapp: undefined, email: undefined, versao: Number(atual!.versao) + 1 });
      return route.fulfill({ json: { id: atual!.id, versao: atual!.versao } });
    }
    if (mr[1] === "respostas") {
      if (String(corpo.titulo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
      if (String(corpo.texto ?? "").trim().length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
      const dados = { tema: corpo.tema, titulo: corpo.titulo, texto: corpo.texto, ativa: corpo.ativa !== false, revisada: !!corpo.revisada,
        ...(corpo.revisada ? { revisadaEm: new Date().toISOString(), revisadaPor: CAROLINA_REF } : { revisadaEm: undefined, revisadaPor: undefined }) };
      if (atual) { Object.assign(atual, dados, { versao: Number(atual.versao) + 1 }); return route.fulfill({ json: { id: atual.id, versao: atual.versao } }); }
      const id = novoId("9c3d4e5f");
      p.respostas.push({ id, ...dados, versao: 1 });
      return route.fulfill({ status: 201, json: { id, versao: 1 } });
    }
    if (atual?.retirada) return erro(route, 400, "VALIDATION_ERROR", { motivo: "REFERENCIA_RETIRADA" });
    if (corpo.escopo === "CONTATO" && !corpo.whatsapp && !corpo.email) return erro(route, 400, "VALIDATION_ERROR", { campos: ["whatsapp"] });
    if (String(corpo.autorizacaoTexto ?? "").trim().length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["autorizacaoTexto"] });
    const dados = { sindico: corpo.sindico, condominio: corpo.condominio, unidades: corpo.unidades ?? undefined, escopo: corpo.escopo,
      whatsapp: corpo.escopo === "CONTATO" && corpo.whatsapp ? `55${String(corpo.whatsapp).replace(/\D/g, "").replace(/^55/, "")}` : undefined,
      email: corpo.escopo === "CONTATO" ? corpo.email ?? undefined : undefined, autorizacaoTexto: corpo.autorizacaoTexto,
      caso: corpo.casoTexto ? { texto: corpo.casoTexto, usoDesde: corpo.casoUsoDesde, medidoEm: corpo.casoMedidoEm } : undefined };
    if (atual) { Object.assign(atual, dados, { versao: Number(atual.versao) + 1 }); return route.fulfill({ json: { id: atual.id, versao: atual.versao } }); }
    const id = novoId("aa4e5f60");
    p.referencias.unshift({ id, ...dados, autorizadoEm: corpo.autorizadoEm, emUso: 0, versao: 1 });
    return route.fulfill({ status: 201, json: { id, versao: 1 } });
  }

  // Fatos do comparativo (0307): a equipe comercial registra, muda e retira.
  const mf = /^\/v1\/comercial\/fatos(?:\/([0-9a-f-]{36}))?(\/retirar)?$/.exec(caminho);
  if (mf) {
    if (!escreve) return erro(route, 404, "NOT_FOUND");
    if (!pode.editar) return erro(route, 403, "FORBIDDEN");
    const atual = mf[1] ? p.fatos.find((f) => f.id === mf[1]) : undefined;
    if (mf[1] && !atual) return erro(route, 404, "NOT_FOUND");
    if (atual && corpo.versao !== atual.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: atual.versao });
    if (atual?.retiradoEm) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FATO_RETIRADO" });
    if (mf[2]) {
      Object.assign(atual!, { retiradoEm: new Date().toISOString(), versao: Number(atual!.versao) + 1 });
      return route.fulfill({ json: { id: atual!.id, versao: atual!.versao } });
    }
    const campos = [...(String(corpo.texto ?? "").trim().length < 2 ? ["texto"] : []), ...(String(corpo.fonte ?? "").trim().length < 3 ? ["fonte"] : [])];
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const dados = { texto: String(corpo.texto).trim(), fonte: String(corpo.fonte).trim(), confirmadoEm: corpo.confirmadoEm ?? p.hoje };
    if (atual) { Object.assign(atual, dados, { versao: Number(atual.versao) + 1 }); return route.fulfill({ json: { id: atual.id, versao: atual.versao } }); }
    const igual = p.fatos.find((f) => !f.retiradoEm && f.criterio === corpo.criterio && chave(f.sistema) === chave(corpo.sistema)
      && (corpo.criterio !== "OUTRO" || f.interessadoId === corpo.interessadoId));
    if (igual) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FATO_EXISTE", fatoId: igual.id });
    const id = novoId("bb5f6071");
    p.fatos.push({ id, sistema: corpo.sistema, criterio: corpo.criterio, interessadoId: corpo.criterio === "OUTRO" ? corpo.interessadoId : null, ...dados, versao: 1 });
    return route.fulfill({ status: 201, json: { id, versao: 1 } });
  }
  if (caminho === "/v1/comercial/propostas" && !escreve) {
    const interessado = url.searchParams.get("interessado");
    const itens = p.propostas.map((x) => itemLista(p, x as Proposta));
    const contagens = Object.fromEntries(["EM_ABERTO", "AGUARDANDO_APROVACAO", "ACEITAS", "VENCIDAS", "RECUSADAS"].map((a) => [a, itens.filter((x) => x.aba === a).length]));
    return route.fulfill({ json: { propostas: interessado ? itens.filter((x) => (x.interessado as Json).id === interessado) : itens, contagens,
      podeEditar: pode.editar, podeAprovarDesconto: pode.desconto } });
  }
  if (caminho === "/v1/comercial/propostas/sugestao") {
    const i = p.interessados.find((x) => x.id === corpo.interessadoId);
    if (!i) return erro(route, 404, "NOT_FOUND");
    return route.fulfill({ json: sugerir(p, i, corpo) });
  }
  if (escreve && !pode.editar && !/\/desconto\/(aprovar|recusar)$/.test(caminho)) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/comercial/propostas") {
    const i = p.interessados.find((x) => x.id === corpo.interessadoId);
    if (!i) return erro(route, 404, "NOT_FOUND");
    const existe = p.propostas.find((x) => x.interessadoId === i.id);
    if (existe) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_EXISTE", propostaId: existe.id });
    const v = montarVersao(p, i, corpo, { id: novoId("8b2c3d4e"), versaoRegistro: 1, numero: 1, situacao: "RASCUNHO" });
    if ("campos" in v && Array.isArray(v.campos)) return erro(route, 400, "VALIDATION_ERROR", { campos: v.campos });
    const id = novoId("8b2c3d4e");
    p.propostas.push({ id, interessadoId: i.id, versao: 1, criadoEm: new Date().toISOString(), versoes: [v as Json] });
    return route.fulfill({ status: 201, json: { id, versaoId: (v as Json).id, numero: 1, situacao: "RASCUNHO", versao: 1 } });
  }

  const m = /^\/v1\/comercial\/propostas\/([0-9a-f-]{36})(\/kit|\/versoes(?:\/([0-9a-f-]{36})(\/[a-z/]+)?)?)?$/.exec(caminho);
  const x = m ? p.propostas.find((y) => y.id === m[1]) as Proposta | undefined : undefined;
  if (!m || !x) return erro(route, 404, "NOT_FOUND");
  const i = (p.interessados.find((y) => y.id === x.interessadoId) ?? {}) as Json;
  if (!m[2] && !escreve) {
    return route.fulfill({ json: {
      id: x.id, versao: x.versao, criadoEm: x.criadoEm,
      interessado: { id: i.id, condominio: i.condominio, pessoa: i.pessoa, etapa: i.etapa, unidades: i.unidades, faixa: i.faixa, anonimizado: false, naoContatar: false },
      versoes: x.versoes.map((v) => versaoParaTela(v, p.hoje)), kitDisponivel: x.versoes.some((v) => ["ENVIADA", "ACEITA"].includes(situacaoDe(v, p.hoje))),
      podeEditar: pode.editar, podeAprovarDesconto: pode.desconto,
    } });
  }
  if (m[2] === "/kit") {
    const v = x.versoes.find((y) => ["ENVIADA", "ACEITA"].includes(situacaoDe(y, p.hoje)));
    if (!v) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_VERSAO_ENVIADA" });
    return route.fulfill({ json: kitDe(p, x, v) });
  }
  if (m[2] === "/versoes" && escreve) {
    if (corpo.versao !== x.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: x.versao });
    if (x.versoes.some((v) => v.situacao === "ACEITA")) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_ACEITA" });
    const atual = x.versoes[0]!;
    const v = montarVersao(p, i, corpo, { id: novoId("8b2c3d4e"), versaoRegistro: 1, numero: Number(atual.numero) + 1, situacao: "RASCUNHO" });
    if ("campos" in v && Array.isArray(v.campos)) return erro(route, 400, "VALIDATION_ERROR", { campos: v.campos });
    if (!vencida(atual, p.hoje)) Object.assign(atual, { situacao: "SUBSTITUIDA", substituidaEm: new Date().toISOString() });
    else atual.situacao = "VENCIDA";
    for (const [k, l] of Object.entries(p.links)) if (l.versaoId === atual.id) delete p.links[k];
    x.versoes.unshift(v as Json);
    x.versao++;
    return route.fulfill({ status: 201, json: { id: x.id, versao: x.versao, versaoId: (v as Json).id, numero: (v as Json).numero, situacao: "RASCUNHO" } });
  }
  const v = m[3] ? x.versoes.find((y) => y.id === m[3]) : undefined;
  if (!v) return erro(route, 404, "NOT_FOUND");
  const acao = m[4] ?? "";
  const confere = () => (corpo.versao !== v.versaoRegistro ? erro(route, 409, "VERSION_CONFLICT", { versao: v.versaoRegistro, atual: versaoParaTela(v, p.hoje) }) : null);
  const subir = (extra: Json) => { Object.assign(v, extra, { versaoRegistro: Number(v.versaoRegistro) + 1 }); return route.fulfill({ json: { id: v.id, versao: v.versaoRegistro, situacao: v.situacao } }); };
  if (acao === "" && metodo === "PUT") {
    const c = confere(); if (c) return c;
    if (!["RASCUNHO", "PRONTA", "AGUARDA_DESCONTO"].includes(String(v.situacao))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VERSAO_ENVIADA" });
    const nova = montarVersao(p, i, corpo, { id: v.id, numero: v.numero, situacao: "RASCUNHO", versaoRegistro: v.versaoRegistro });
    if ("campos" in nova && Array.isArray(nova.campos)) return erro(route, 400, "VALIDATION_ERROR", { campos: nova.campos });
    for (const k of Object.keys(v)) delete v[k];
    return subir(nova as Json);
  }
  if (acao === "/desconto/pedir") {
    const c = confere(); if (c) return c;
    if (!v._pct && v.tabela !== "MANUAL") return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_DESCONTO" });
    if (v.situacao !== "RASCUNHO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESCONTO_JA_PEDIDO" });
    return subir({ situacao: "AGUARDA_DESCONTO", descontoSituacao: "PEDIDO",
      descontoPedido: { ...(v._pct ? { percentual: v._pct, motivo: v._motivo } : {}), situacao: "PEDIDO", pedidoEm: new Date().toISOString(), pedidoPor: BIANCA,
        ...(v.tabela === "MANUAL" ? { sobConsulta: true, valorManual: v.mensalTabela, implantacaoManual: v.implantacao, valorManualMotivo: v.valorManualMotivo } : {}) } });
  }
  if (acao === "/desconto/aprovar" || acao === "/desconto/recusar") {
    if (!pode.desconto) return erro(route, 403, "FORBIDDEN");
    const c = confere(); if (c) return c;
    if (v.situacao !== "AGUARDA_DESCONTO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESCONTO_NAO_PEDIDO" });
    const aprovar = acao === "/desconto/aprovar";
    if (!aprovar && String(corpo.resposta ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["resposta"] });
    const sit = aprovar ? "APROVADO" : "RECUSADO";
    return subir({ situacao: aprovar ? "PRONTA" : "RASCUNHO", descontoSituacao: sit,
      descontoPedido: { ...(v.descontoPedido as Json), situacao: sit, resposta: corpo.resposta ?? undefined, respondidoEm: new Date().toISOString(), respondidoPor: CAROLINA_REF } });
  }
  if (acao === "/enviar") {
    const c = confere(); if (c) return c;
    if (!["RASCUNHO", "PRONTA"].includes(String(v.situacao))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "VERSAO_ENVIADA" });
    if (v._pct && v.descontoSituacao !== "APROVADO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "DESCONTO_SEM_APROVACAO" });
    if (v.tabela === "MANUAL" && v.descontoSituacao !== "APROVADO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "SOB_CONSULTA_SEM_APROVACAO" });
    if (v.mensal === undefined) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_SEM_VALOR" });
    Object.assign(v, { situacao: "ENVIADA", validoAte: somarDias(p.hoje, Number(v.validadeDias ?? 15)), hash: "e1f0".padEnd(64, String(v.numero)), enviadaEm: new Date().toISOString(),
      enviadaPor: BIANCA, versaoRegistro: Number(v.versaoRegistro) + 1 });
    i.etapa = "PROPOSTA_ENVIADA";
    const link = gerarLink(p, x, v);
    return route.fulfill({ json: { id: v.id, versao: v.versaoRegistro, numero: v.numero, situacao: "ENVIADA", validoAte: v.validoAte, hash: v.hash, link } });
  }
  if (acao === "/link") {
    if (!["ENVIADA", "ACEITA"].includes(situacaoDe(v, p.hoje))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_LINK" });
    return route.fulfill({ status: 201, json: { id: v.id, link: gerarLink(p, x, v) } });
  }
  if (acao === "/revogar") {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    const antes = Object.keys(p.links).length;
    for (const [k, l] of Object.entries(p.links)) if (l.versaoId === v.id) delete p.links[k];
    if (antes === Object.keys(p.links).length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_LINK" });
    v.link = { ...(v.link as Json), ativo: false, revogadoEm: new Date().toISOString(), revogadoMotivo: corpo.motivo };
    return route.fulfill({ json: { id: v.id, revogados: 1 } });
  }
  if (acao === "/recusada") {
    const c = confere(); if (c) return c;
    if (situacaoDe(v, p.hoje) !== "ENVIADA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_INDISPONIVEL" });
    for (const [k, l] of Object.entries(p.links)) if (l.versaoId === v.id) delete p.links[k];
    return subir({ situacao: "RECUSADA", recusa: { em: new Date().toISOString(), motivo: corpo.motivo, por: BIANCA }, link: { ...(v.link as Json), ativo: false } });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** As rotas públicas do link (4.1 a 4.3), sem sessão. */
export async function rotasPublicasPropostas(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json) {
  const m = /^\/v1\/publico\/propostas\/([A-Za-z0-9_-]+)(\/kit|\/aceite)?$/.exec(caminho);
  if (!m) return null;
  const l = m[1]!.length >= 20 && m[1]!.length <= 64 ? p.links[m[1]!] : undefined;
  const x = l ? p.propostas.find((y) => y.id === l.propostaId) as Proposta | undefined : undefined;
  const v = x?.versoes.find((y) => y.id === l!.versaoId);
  if (!x || !v || !["ENVIADA", "ACEITA", "VENCIDA"].includes(String(v.situacao))) return erro(route, 404, "NOT_FOUND");
  if (v.situacao !== "ACEITA" && vencida(v, p.hoje)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_VENCIDA", validoAte: v.validoAte });
  if (!m[2] && metodo === "GET") {
    const a = v.aberturas as { total: number; aparelhos: number };
    v.aberturas = { total: a.total + 1, aparelhos: a.aparelhos || 1, ultima: new Date().toISOString() };
    return route.fulfill({ json: propostaPublica(p, x, v) });
  }
  if (m[2] === "/kit") {
    const k = kitDe(p, x, v);
    delete k.propostaId; delete k.versaoId; delete k.respostasDisponiveis; delete k.interessado; delete k.fatos; delete k.podeEditar;
    return route.fulfill({ json: k });
  }
  if (m[2] === "/aceite" && metodo === "POST") {
    p.pedidos.push({ caminho, corpo });
    if (v.situacao === "ACEITA") return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROPOSTA_JA_ACEITA" });
    const campos = [
      ...(String(corpo.nome ?? "").trim().length < 2 ? ["nome"] : []), ...(!cpfValido(String(corpo.cpf ?? "")) ? ["cpf"] : []),
      ...(String(corpo.cargo ?? "").trim().length < 2 ? ["cargo"] : []), ...(corpo.concordo !== true ? ["concordo"] : []),
    ];
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    const em = new Date().toISOString();
    const d = String(corpo.cpf).replace(/\D/g, "");
    Object.assign(v, { situacao: "ACEITA", aceite: { nome: corpo.nome, cargo: corpo.cargo, em, ip: "177.10.20.30", hashVersao: v.hash, cpfMascarado: `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••` },
      versaoRegistro: Number(v.versaoRegistro) + 1 });
    const i = p.interessados.find((y) => y.id === x.interessadoId);
    if (i) i.etapa = "NEGOCIACAO";
    return route.fulfill({ status: 201, json: { situacao: "ACEITA", numero: v.numero, nome: corpo.nome, cargo: corpo.cargo, aceitoEm: em, hash: v.hash } });
  }
  return erro(route, 404, "NOT_FOUND");
}

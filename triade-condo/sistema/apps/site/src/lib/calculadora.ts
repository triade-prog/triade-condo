// Calculadora de custo por apartamento (CM-33, DC17; quadros 448 e 449, no lugar do 348).
// O preço vem da Tabela de preços do Console (rota /v1/site/calculadora, com o segredo do site e o
// IP de quem usa, para o limite por pessoa), guardado 10 minutos por número de unidades. Com a rota
// fora do ar, vale o último preço que deu certo para a faixa (até 24 horas); sem ele, a tabela cheia
// da oferta do site (dados/oferta.ts, DC16), nunca o preço de fundador sem a vaga confirmada, com o
// "a partir de" do /precos. O "menos de R$ 5" e o peso na taxa saem da regra única do domínio
// (taxa_condominio), a mesma do Console. Sem ROI e sem economia prometida (EM-07).

import {
  custoNaTaxa,
  fraseDoDestaque,
  lerTaxaCondominio,
  linhaNaTaxa,
  TEXTO_MENOS_DE_CINCO,
  taxaParaCampo,
} from "../../../../packages/domain/src/taxa_condominio.ts";
import { faixas, fundadores } from "../dados/oferta";
import { normalizarWhatsapp, type lerUtm } from "./lead";

export { TEXTO_AJUDA_TAXA_SITE } from "../../../../packages/domain/src/taxa_condominio.ts";

export type CodigoFaixa = "ATE_40" | "DE_41_A_100" | "DE_101_A_200" | "DE_201_A_400" | "ACIMA_DE_400";

/** As faixas da Tabela de preços (0295), na ordem; a última é sob consulta. */
const LIMITES: { codigo: CodigoFaixa; ate: number | null; nome: string }[] = [
  { codigo: "ATE_40", ate: 40, nome: "Até 40 unidades" },
  { codigo: "DE_41_A_100", ate: 100, nome: "41 a 100 unidades" },
  { codigo: "DE_101_A_200", ate: 200, nome: "101 a 200 unidades" },
  { codigo: "DE_201_A_400", ate: 400, nome: "201 a 400 unidades" },
  { codigo: "ACIMA_DE_400", ate: null, nome: "Acima de 400 unidades" },
];

export const UNIDADES_MAXIMAS = 20000;

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

/** O que a rota da calculadora devolve (comercial_calculadora_site); valores em centavos. */
export type Preco = {
  unidades: number;
  faixa: { codigo: CodigoFaixa; nome: string; sobConsulta: boolean };
  tabela?: "FUNDADOR" | "CHEIA" | string;
  mensal?: number;
  porApartamento?: number;
  depoisFundador?: number;
  fundadorMeses?: number;
  /** De onde veio: a Tabela agora, o último preço da Tabela para a faixa ou a tabela cheia do site. */
  origem?: "TABELA" | "ULTIMO" | "SITE";
};

export function faixaDasUnidades(unidades: number): (typeof LIMITES)[number] {
  return LIMITES.find((l) => l.ate === null || unidades <= l.ate) as (typeof LIMITES)[number];
}

const porApartamento = (mensal: number, unidades: number) => Math.max(Math.round(mensal / unidades), 1);

/**
 * O preço pela oferta do site, quando a Tabela de preços não responde e não há preço recente dela:
 * sempre a tabela cheia (r9). O preço de fundador depende da vaga, que só a Tabela confirma.
 */
export function precoDoSite(unidades: number): Preco {
  const l = faixaDasUnidades(unidades);
  const i = LIMITES.indexOf(l);
  const f = faixas[i];
  if (l.ate === null || !f) return { unidades, faixa: { codigo: l.codigo, nome: l.nome, sobConsulta: true }, origem: "SITE" };
  const mensal = f.mensal * 100;
  return { unidades, faixa: { codigo: l.codigo, nome: l.nome, sobConsulta: false }, tabela: "CHEIA", mensal, porApartamento: porApartamento(mensal, unidades), origem: "SITE" };
}

/** A linha sob a conta quando o valor é o da tabela cheia do site, como diz o /precos. */
export function avisoTabelaCheia(): string {
  return fundadores.vagasAbertas
    ? `Valor da tabela cheia. Condomínios fundadores: a partir de ${reais(faixas[0]!.fundador * 100)}/mês, só no mensal, vagas limitadas; a proposta confirma.`
    : "Valor da tabela cheia; a proposta confirma.";
}

type EnvCalculadora = { SUPABASE_FUNCTIONS_URL?: string; SITE_SEGREDO?: string };

// ---------------- A memória do preço (r9), por instância do servidor.

const GUARDA_MS = 10 * 60_000;
const ULTIMO_MS = 24 * 60 * 60_000;
const MAX_GUARDADOS = 500;
const guardados = new Map<number, { preco: Preco; ate: number }>();
const ultimos = new Map<CodigoFaixa, { preco: Preco; em: number }>();

/** Esquece os preços guardados (para os testes). */
export function esquecerPrecos() {
  guardados.clear();
  ultimos.clear();
}

function guardar(preco: Preco, agora: number) {
  if (guardados.size >= MAX_GUARDADOS) guardados.delete(guardados.keys().next().value as number);
  guardados.set(preco.unidades, { preco, ate: agora + GUARDA_MS });
  if (!preco.faixa.sobConsulta) ultimos.set(preco.faixa.codigo, { preco, em: agora });
}

/** O último preço que a Tabela deu para a faixa, refeito para estas unidades. */
function ultimoDaFaixa(unidades: number, agora: number): Preco | null {
  const l = faixaDasUnidades(unidades);
  if (l.ate === null) return null;
  const u = ultimos.get(l.codigo);
  if (!u || agora - u.em > ULTIMO_MS || typeof u.preco.mensal !== "number") return null;
  return { ...u.preco, unidades, porApartamento: porApartamento(u.preco.mensal, unidades), origem: "ULTIMO" };
}

/** Limite por chave numa janela (r9), em memória, por instância do servidor. */
export function criarLimite(max: number, janelaMs: number) {
  const usos = new Map<string, { n: number; desde: number }>();
  return (chave: string, agora = Date.now()): boolean => {
    if (usos.size > 5000) for (const [k, u] of usos) if (agora - u.desde >= janelaMs) usos.delete(k);
    const u = usos.get(chave);
    if (!u || agora - u.desde >= janelaMs) {
      usos.set(chave, { n: 1, desde: agora });
      return true;
    }
    u.n += 1;
    return u.n <= max;
  };
}

const lerLimite = () => {
  const n = Number((typeof process !== "undefined" ? process.env.CALCULADORA_LIMITE_IP : undefined) ?? "");
  return Number.isInteger(n) && n > 0 ? n : 60;
};
/** 60 contas a cada 10 minutos por IP (CALCULADORA_LIMITE_IP muda o número). */
export const dentroDoLimiteDaCalculadora = criarLimite(lerLimite(), 10 * 60_000);

/** O IP de quem pediu: o primeiro do x-forwarded-for (a Vercel põe) ou o endereço da conexão. */
export function ipDoPedido(request: Request, endereco: () => string | undefined): string {
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (encaminhado) return encaminhado.slice(0, 64);
  try {
    return (endereco() ?? "").slice(0, 64) || "sem-ip";
  } catch {
    return "sem-ip";
  }
}

function precoValido(d: unknown, unidades: number): d is Preco {
  if (!d || typeof d !== "object") return false;
  const p = d as Preco;
  if (p.unidades !== unidades || !p.faixa || !LIMITES.some((l) => l.codigo === p.faixa.codigo) || typeof p.faixa.nome !== "string") return false;
  if (p.faixa.sobConsulta) return true;
  return Number.isSafeInteger(p.mensal) && Number.isSafeInteger(p.porApartamento) && (p.porApartamento as number) > 0;
}

export type OpcoesPreco = {
  /** O IP de quem usa, repassado ao Console para o limite por pessoa. */
  cliente?: string | null;
  /** Acima do limite do site: só a memória ou a tabela cheia, sem chamar o Console. */
  semConsultar?: boolean;
  agora?: number;
};

/**
 * O preço pela Tabela de preços do Console, guardado 10 minutos por unidades. Sem configuração,
 * com erro ou resposta estranha: o último preço da Tabela para a faixa; sem ele, a tabela cheia.
 */
export async function buscarPreco(unidades: number, env: EnvCalculadora, buscar: typeof fetch = fetch, opcoes: OpcoesPreco = {}): Promise<Preco> {
  const agora = opcoes.agora ?? Date.now();
  const guardado = guardados.get(unidades);
  if (guardado && guardado.ate > agora) return guardado.preco;
  if (env.SUPABASE_FUNCTIONS_URL && env.SITE_SEGREDO && !opcoes.semConsultar) {
    try {
      const r = await buscar(`${env.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/api-console/v1/site/calculadora`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-site-segredo": env.SITE_SEGREDO,
          ...(opcoes.cliente ? { "x-site-cliente": opcoes.cliente.slice(0, 64) } : {}),
        },
        body: JSON.stringify({ unidades }),
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const d: unknown = await r.json();
        if (precoValido(d, unidades)) {
          const preco: Preco = { ...d, origem: "TABELA" };
          guardar(preco, agora);
          return preco;
        }
      }
    } catch {
      // Fora do ar: cai na memória ou na tabela cheia.
    }
  }
  return ultimoDaFaixa(unidades, agora) ?? precoDoSite(unidades);
}

export type Entrada = {
  unidades: number | null;
  taxa: number | null;
  /** O que a pessoa digitou, para devolver ao campo. */
  campoUnidades: string;
  campoTaxa: string;
  erros: { unidades?: string; taxa?: string };
};

const MENSAGEM_UNIDADES = "Digite as unidades do prédio, de 1 a 20.000.";

/** Lê as unidades e a taxa (opcional) do endereço ou do formulário. Vazio não é erro: só não calcula. */
export function lerEntrada(unidades: unknown, taxa: unknown): Entrada {
  const u = typeof unidades === "string" ? unidades.trim().slice(0, 12) : "";
  const t = typeof taxa === "string" ? taxa.trim().slice(0, 20) : "";
  const erros: Entrada["erros"] = {};
  let n: number | null = null;
  if (u) {
    const d = u.replace(/\./g, "");
    if (/^\d{1,5}$/.test(d) && Number(d) >= 1 && Number(d) <= UNIDADES_MAXIMAS) n = Number(d);
    else erros.unidades = MENSAGEM_UNIDADES;
  }
  const lida = lerTaxaCondominio(t);
  if (lida.erro) erros.taxa = lida.erro;
  return { unidades: n, taxa: lida.erro ? null : lida.taxa, campoUnidades: u, campoTaxa: t, erros };
}


/** "Até 40 unidades" vira "até 40 unidades" depois de "Faixa:". */
const nomeNaFrase = (nome: string) => nome.charAt(0).toLowerCase() + nome.slice(1);

export type Resultado = {
  unidades: number;
  faixa: CodigoFaixa;
  /** "Faixa: 41 a 100 unidades". */
  faixaTexto: string;
  sobConsulta: boolean;
  /** "R$ 3,58"; nulo sob consulta. */
  porApartamento: string | null;
  /** "R$ 229,00 · preço de fundador". */
  mensalidade: string | null;
  /** O destaque, só quando o valor por apartamento fica abaixo de R$ 5,00. */
  destaque: { titulo: string; frase: string } | null;
  /** "cerca de 0,6% de R$ 650,00"; só com a taxa. */
  naTaxa: string | null;
  /** Sem a Tabela de preços: a linha da tabela cheia (r9). */
  aviso: string | null;
};

/** O que a tela mostra, a partir do preço e da taxa informada (quadros 448 e 449). */
export function montarResultado(p: Preco, taxa: number | null): Resultado {
  const base = { unidades: p.unidades, faixa: p.faixa.codigo, faixaTexto: `Faixa: ${nomeNaFrase(p.faixa.nome)}` };
  if (p.faixa.sobConsulta || typeof p.porApartamento !== "number" || typeof p.mensal !== "number") {
    return { ...base, sobConsulta: true, porApartamento: null, mensalidade: null, destaque: null, naTaxa: null, aviso: null };
  }
  const c = custoNaTaxa(p.porApartamento, taxa);
  return {
    ...base,
    sobConsulta: false,
    porApartamento: reais(p.porApartamento),
    mensalidade: p.tabela === "FUNDADOR" ? `${reais(p.mensal)} · preço de fundador` : reais(p.mensal),
    // Sem a taxa, a frase do quadro 448 fica só no valor ("R$ 3,58 por apartamento."): o "por mês" já está no título.
    destaque: c.menosDeCinco ? { titulo: TEXTO_MENOS_DE_CINCO, frase: c.cerca ? fraseDoDestaque(c) : `${reais(p.porApartamento)} por apartamento.` } : null,
    naTaxa: linhaNaTaxa(c),
    aviso: p.origem === "SITE" ? avisoTabelaCheia() : null,
  };
}

/** A taxa para o campo escondido do pedido ("650.00"), no formato que a rota do Comercial aceita. */
export function taxaParaEnvio(taxa: number | null): string {
  return taxa === null ? "" : (Math.round(taxa * 100) / 100).toFixed(2);
}

export { taxaParaCampo };

// ---------------- O pedido de proposta (vira interessado, como o pedido de demonstração)

/** O texto ao lado da caixa de autorização (quadro 448); vai junto para a base legal do interessado. */
export const TEXTO_CONSENTIMENTO_PROPOSTA = "Autorizo a TRÍADE a usar estes dados para mandar a proposta e falar comigo sobre ela.";

export type PedidoProposta = { nome: string; whatsapp: string; unidades: number; taxa: number | null };
export type CampoProposta = "nome" | "whatsapp" | "consentimento" | "unidades" | "taxa";
export type ValidacaoProposta = { ok: true; pedido: PedidoProposta } | { ok: false; erros: Partial<Record<CampoProposta, string>> };

const limpar = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function validarProposta(dados: Record<string, unknown>): ValidacaoProposta {
  const erros: Partial<Record<CampoProposta, string>> = {};
  const nome = limpar(dados.nome);
  const whatsapp = normalizarWhatsapp(limpar(dados.whatsapp));
  const consentimento = dados.consentimento === true || dados.consentimento === "on" || dados.consentimento === "sim";
  const entrada = lerEntrada(String(dados.unidades ?? ""), String(dados.taxa ?? ""));
  if (nome.length < 2) erros.nome = "Escreva o seu nome.";
  else if (nome.length > 80) erros.nome = "Use até 80 letras.";
  if (!whatsapp) erros.whatsapp = "Falta o WhatsApp, com DDD. Sem ele não conseguimos mandar a proposta.";
  if (!consentimento) erros.consentimento = "Marque a autorização para podermos mandar a proposta.";
  if (entrada.unidades === null) erros.unidades = entrada.erros.unidades ?? MENSAGEM_UNIDADES;
  if (entrada.erros.taxa) erros.taxa = entrada.erros.taxa;
  if (Object.keys(erros).length > 0 || !whatsapp || entrada.unidades === null) return { ok: false, erros };
  return { ok: true, pedido: { nome, whatsapp, unidades: entrada.unidades, taxa: entrada.taxa } };
}

/** O condomínio ainda sem nome: a ficha mostra de onde veio e a equipe completa na conversa. */
export function condominioDoPedido(p: PedidoProposta): string {
  return `Condomínio a informar (calculadora do site, ${p.unidades} unidades)`;
}

/** O corpo da rota /v1/site/interessados: pedido de proposta, com a faixa, as unidades e a taxa já preenchidas. */
export function corpoDaProposta(p: PedidoProposta, extra: { utm: ReturnType<typeof lerUtm>; pagina?: string | null }) {
  return {
    nome: p.nome,
    whatsapp: p.whatsapp,
    condominio: condominioDoPedido(p),
    faixa: faixaDasUnidades(p.unidades).codigo,
    pedido: "PROPOSTA",
    unidades: p.unidades,
    taxaCondominio: p.taxa,
    consentimento: true,
    consentimentoTexto: TEXTO_CONSENTIMENTO_PROPOSTA,
    pagina: extra.pagina?.slice(0, 200) || "/calculadora",
    utm: extra.utm,
  };
}

export type EnvioProposta = { ok: true } | { ok: false; motivo: "sem-configuracao" | "falha-envio" };

/** Grava o pedido de proposta no Comercial do Console, pelo mesmo caminho do pedido de demonstração. */
export async function enviarProposta(
  p: PedidoProposta,
  extra: { utm: ReturnType<typeof lerUtm>; pagina?: string | null },
  env: EnvCalculadora,
  buscar: typeof fetch = fetch,
): Promise<EnvioProposta> {
  if (!env.SUPABASE_FUNCTIONS_URL || !env.SITE_SEGREDO) return { ok: false, motivo: "sem-configuracao" };
  try {
    const r = await buscar(`${env.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/api-console/v1/site/interessados`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-site-segredo": env.SITE_SEGREDO },
      body: JSON.stringify(corpoDaProposta(p, extra)),
    });
    return r.ok ? { ok: true } : { ok: false, motivo: "falha-envio" };
  } catch {
    return { ok: false, motivo: "falha-envio" };
  }
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** O aviso por e-mail para a equipe (o mesmo Resend do pedido de demonstração). */
export function emailDaProposta(p: PedidoProposta, recebidoEm: Date) {
  const quando = recebidoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const linhas: [string, string][] = [
    ["Nome", p.nome],
    ["WhatsApp", `+${p.whatsapp}`],
    ["Unidades", `${p.unidades} (${faixaDasUnidades(p.unidades).nome})`],
    ["Taxa média de condomínio", p.taxa === null ? "não informada" : reais(Math.round(p.taxa * 100))],
    ["Recebido em", `${quando} (Brasília)`],
  ];
  const assunto = `Proposta pela calculadora: ${p.unidades} unidades`;
  const texto = linhas.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nPrimeiro retorno no próximo dia útil: https://wa.me/${p.whatsapp}`;
  const html = `<p>Novo pedido de proposta pela calculadora do site.</p><table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${linhas
    .map(([k, v]) => `<tr><td style="color:#5e5475">${escapar(k)}</td><td><b>${escapar(v)}</b></td></tr>`)
    .join("")}</table><p style="font-family:sans-serif;font-size:14px">Primeiro retorno no próximo dia útil. <a href="https://wa.me/${p.whatsapp}">Abrir a conversa</a>.</p>`;
  return { assunto, texto, html };
}

export async function avisarProposta(
  p: PedidoProposta,
  env: { RESEND_API_KEY?: string; LEADS_EMAIL_DE?: string; LEADS_EMAIL_PARA?: string },
  agora = new Date(),
  buscar: typeof fetch = fetch,
): Promise<EnvioProposta> {
  if (!env.RESEND_API_KEY || !env.LEADS_EMAIL_PARA || !env.LEADS_EMAIL_DE) return { ok: false, motivo: "sem-configuracao" };
  const { assunto, texto, html } = emailDaProposta(p, agora);
  try {
    const r = await buscar("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.LEADS_EMAIL_DE, to: env.LEADS_EMAIL_PARA.split(",").map((s) => s.trim()).filter(Boolean), subject: assunto, text: texto, html }),
    });
    return r.ok ? { ok: true } : { ok: false, motivo: "falha-envio" };
  } catch {
    return { ok: false, motivo: "falha-envio" };
  }
}

/** As variáveis do servidor (Vercel), lidas do mesmo jeito que o pedido de demonstração. */
export function envServidor() {
  const ler = (k: string) => (import.meta.env[k] as string | undefined) ?? process.env[k];
  return {
    SUPABASE_FUNCTIONS_URL: ler("SUPABASE_FUNCTIONS_URL"),
    SITE_SEGREDO: ler("SITE_SEGREDO"),
    RESEND_API_KEY: ler("RESEND_API_KEY"),
    LEADS_EMAIL_DE: ler("LEADS_EMAIL_DE"),
    LEADS_EMAIL_PARA: ler("LEADS_EMAIL_PARA"),
  };
}

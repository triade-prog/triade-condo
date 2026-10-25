// Calculadora de custo por apartamento (CM-33, DC17; quadros 448 e 449, no lugar do 348).
// O preço vem da Tabela de preços do Console (rota /v1/site/calculadora, com o segredo do site);
// sem a rota configurada ou fora do ar, vem da oferta do site (dados/oferta.ts, os mesmos valores
// do DC16). O "menos de R$ 5" e o peso na taxa saem da regra única do domínio (taxa_condominio),
// a mesma do Console. Sem ROI e sem economia prometida (EM-07).

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

/** O que a rota da calculadora devolve (comercial_calculadora_site); valores em centavos. */
export type Preco = {
  unidades: number;
  faixa: { codigo: CodigoFaixa; nome: string; sobConsulta: boolean };
  tabela?: "FUNDADOR" | "CHEIA" | string;
  mensal?: number;
  porApartamento?: number;
  depoisFundador?: number;
  fundadorMeses?: number;
};

export function faixaDasUnidades(unidades: number): (typeof LIMITES)[number] {
  return LIMITES.find((l) => l.ate === null || unidades <= l.ate) as (typeof LIMITES)[number];
}

/** O preço pela oferta do site, quando a Tabela de preços não responde: a mesma conta do banco. */
export function precoDoSite(unidades: number): Preco {
  const l = faixaDasUnidades(unidades);
  const i = LIMITES.indexOf(l);
  const f = faixas[i];
  if (l.ate === null || !f) return { unidades, faixa: { codigo: l.codigo, nome: l.nome, sobConsulta: true } };
  const fundador = fundadores.vagasAbertas;
  const mensal = (fundador ? f.fundador : f.mensal) * 100;
  return {
    unidades,
    faixa: { codigo: l.codigo, nome: l.nome, sobConsulta: false },
    tabela: fundador ? "FUNDADOR" : "CHEIA",
    mensal,
    porApartamento: Math.max(Math.round(mensal / unidades), 1),
    ...(fundador ? { depoisFundador: f.mensal * 100, fundadorMeses: fundadores.meses } : {}),
  };
}

type EnvCalculadora = { SUPABASE_FUNCTIONS_URL?: string; SITE_SEGREDO?: string };

function precoValido(d: unknown, unidades: number): d is Preco {
  if (!d || typeof d !== "object") return false;
  const p = d as Preco;
  if (p.unidades !== unidades || !p.faixa || !LIMITES.some((l) => l.codigo === p.faixa.codigo) || typeof p.faixa.nome !== "string") return false;
  if (p.faixa.sobConsulta) return true;
  return Number.isSafeInteger(p.mensal) && Number.isSafeInteger(p.porApartamento) && (p.porApartamento as number) > 0;
}

/** O preço pela Tabela de preços do Console; sem configuração, com erro ou resposta estranha, pela oferta do site. */
export async function buscarPreco(unidades: number, env: EnvCalculadora, buscar: typeof fetch = fetch): Promise<Preco> {
  if (!env.SUPABASE_FUNCTIONS_URL || !env.SITE_SEGREDO) return precoDoSite(unidades);
  try {
    const r = await buscar(`${env.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/api-console/v1/site/calculadora`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-site-segredo": env.SITE_SEGREDO },
      body: JSON.stringify({ unidades }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return precoDoSite(unidades);
    const d = await r.json();
    return precoValido(d, unidades) ? d : precoDoSite(unidades);
  } catch {
    return precoDoSite(unidades);
  }
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

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

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
};

/** O que a tela mostra, a partir do preço e da taxa informada (quadros 448 e 449). */
export function montarResultado(p: Preco, taxa: number | null): Resultado {
  const base = { unidades: p.unidades, faixa: p.faixa.codigo, faixaTexto: `Faixa: ${nomeNaFrase(p.faixa.nome)}` };
  if (p.faixa.sobConsulta || typeof p.porApartamento !== "number" || typeof p.mensal !== "number") {
    return { ...base, sobConsulta: true, porApartamento: null, mensalidade: null, destaque: null, naTaxa: null };
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

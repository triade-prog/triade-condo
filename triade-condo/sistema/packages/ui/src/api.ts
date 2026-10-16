// Chamadas da tela para a própria API do app (/api, repassada à Edge Function). A tela nunca
// mostra a mensagem crua: traduz o código do erro (e o motivo, quando houver).

import { ehCodigoErro, TEXTOS_ERRO, TEXTOS_MOTIVO, type CodigoErro } from "@triade/domain";

export interface ErroApi {
  codigo: CodigoErro;
  detalhes?: Record<string, unknown>;
}

export type Resposta<T> = { ok: true; dados: T } | { ok: false; status: number; erro: ErroApi };

export async function chamarApi<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PUT"; corpo?: unknown; sinal?: AbortSignal } = {},
): Promise<Resposta<T>> {
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
      headers: opcoes.corpo === undefined ? undefined : { "content-type": "application/json" },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      credentials: "same-origin",
      cache: "no-store",
      signal: opcoes.sinal,
    });
  } catch {
    return { ok: false, status: 0, erro: { codigo: "UPSTREAM_UNAVAILABLE" } };
  }
  const corpo = (await r.json().catch(() => null)) as { erro?: ErroApi } | null;
  if (r.ok) return { ok: true, dados: corpo as T };
  const e = corpo?.erro;
  return {
    ok: false,
    status: r.status,
    erro: e && ehCodigoErro(e.codigo) ? e : { codigo: r.status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR" },
  };
}

/** O texto que a pessoa lê: o motivo da recusa, se houver, ou o texto do código. */
export function textoDoErro(e: ErroApi): string {
  const motivo = e.detalhes?.motivo;
  return (typeof motivo === "string" && TEXTOS_MOTIVO[motivo]) || TEXTOS_ERRO[e.codigo];
}

/** Campos que a API recusou, para a tela destacar. */
export function camposComErro(e: ErroApi | null | undefined): string[] {
  const c = e?.detalhes?.campos;
  return Array.isArray(c) ? c.map(String) : [];
}

/** Sessão ausente ou incompleta: a tela leva para o login. */
export function pedeLogin(e: ErroApi): boolean {
  return e.codigo === "UNAUTHORIZED" || e.codigo === "MFA_REQUIRED" || e.codigo === "EMAIL_NOT_VERIFIED";
}

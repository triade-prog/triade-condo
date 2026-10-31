"use client";
// A janela da Meta (cadastro incorporado do WhatsApp, quadro 466). O SDK do Facebook entra só em
// Configurações › WhatsApp, a única página com a CSP que libera o facebook.com e o COOP que deixa
// a janela falar com a página. Por isso o documento precisa nascer nessa rota: vindo de outra
// página pelo lado do cliente, a página recarrega uma vez antes de mostrar o botão. Quem abre a
// janela é o clique (FB.login dentro dele), senão o navegador bloqueia.

import { useEffect, useState } from "react";

export const ROTA_JANELA_META = "/configuracoes/whatsapp";
const SDK = "https://connect.facebook.net/pt_BR/sdk.js";
const VERSAO_GRAPH = "v26.0";
/** Só a Meta fala com a página: a origem exata, nunca um sufixo. */
const ORIGENS_META = new Set(["https://www.facebook.com", "https://web.facebook.com"]);
const CHAVE_RECARGA = "triade.janela-meta.recarregou";

interface RespostaLogin { authResponse?: { code?: string } | null; status?: string }
export interface SdkMeta {
  init(o: { appId: string; version: string; xfbml: boolean; cookie: boolean }): void;
  login(cb: (r: RespostaLogin) => void, o: Record<string, unknown>): void;
}
declare global {
  interface Window { FB?: SdkMeta }
}

/** O que a janela devolveu: tudo para ligar, fechou no meio ou o navegador não deixou abrir. */
export type FimJanela =
  | { tipo: "pronto"; code: string; wabaId: string; numeroId: string; empresaId: string | null }
  | { tipo: "fechou" }
  | { tipo: "bloqueada" };

function nasceuNaRota(): boolean {
  const nav = performance.getEntriesByType("navigation")[0];
  if (!nav) return false;
  try {
    return new URL(nav.name).pathname.replace(/\/+$/, "") === ROTA_JANELA_META;
  } catch {
    return false;
  }
}

/** Recarrega a página uma vez só (a marca vale um minuto); sem sessionStorage, não recarrega. */
function recarregarUmaVez(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(CHAVE_RECARGA) ?? 0) < 60000) return false;
    sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function esquecerRecarga() {
  try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* sem armazenamento, nada a limpar */ }
}

let carregando: Promise<SdkMeta> | null = null;

function carregarSdk(appId: string): Promise<SdkMeta> {
  carregando ??= new Promise<SdkMeta>((ok, falha) => {
    const pronto = () => {
      const fb = window.FB;
      if (!fb) return falha(new Error("SDK da Meta sem FB"));
      fb.init({ appId, version: VERSAO_GRAPH, xfbml: false, cookie: false });
      ok(fb);
    };
    if (window.FB) return pronto();
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.crossOrigin = "anonymous";
    // O nonce da página (o navegador esconde o atributo, mas a propriedade continua lá).
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) s.nonce = nonce;
    const limite = window.setTimeout(() => falha(new Error("SDK da Meta demorou")), 20000);
    s.onload = () => { window.clearTimeout(limite); pronto(); };
    s.onerror = () => { window.clearTimeout(limite); falha(new Error("SDK da Meta não carregou")); };
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    carregando = null;
    throw e;
  });
  return carregando;
}

export type EstadoSdk = { estado: "carregando" } | { estado: "pronto"; fb: SdkMeta } | { estado: "falhou" };

/** Carrega o SDK quando o botão vai aparecer; fora da rota certa ou se falhar, recarrega uma vez. */
export function useSdkMeta(ativo: boolean, appId: string): EstadoSdk {
  const [sdk, setSdk] = useState<EstadoSdk>({ estado: "carregando" });
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    if (!nasceuNaRota()) {
      if (!recarregarUmaVez()) setSdk({ estado: "falhou" });
      return;
    }
    carregarSdk(appId).then(
      (fb) => { esquecerRecarga(); if (vivo) setSdk({ estado: "pronto", fb }); },
      () => { if (!recarregarUmaVez() && vivo) setSdk({ estado: "falhou" }); },
    );
    return () => { vivo = false; };
  }, [ativo, appId]);
  return sdk;
}

let cancelarAnterior: (() => void) | null = null;

/**
 * Abre a janela (chame direto no clique). O code (do FB.login) e os ids (do evento FINISH) chegam
 * em qualquer ordem; a promessa resolve quando os dois chegaram ou quando a janela fechou no meio.
 */
export function abrirJanelaMeta(fb: SdkMeta, configId: string): Promise<FimJanela> {
  cancelarAnterior?.();
  return new Promise<FimJanela>((resolver) => {
    const inicio = Date.now();
    let code: string | null = null;
    let ids: { wabaId: string; numeroId: string; empresaId: string | null } | null = null;
    let ouviuMeta = false;
    let acabou = false;
    let espera = 0;

    const fim = (r: FimJanela) => {
      if (acabou) return;
      acabou = true;
      window.removeEventListener("message", ouvir);
      window.clearTimeout(espera);
      if (cancelarAnterior === cancelar) cancelarAnterior = null;
      resolver(r);
    };
    const cancelar = () => fim({ tipo: "fechou" });
    const conferir = () => { if (code && ids) fim({ tipo: "pronto", code, ...ids }); };

    function ouvir(ev: MessageEvent) {
      if (!ORIGENS_META.has(ev.origin)) return;
      let d: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
      try {
        d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      } catch {
        return;
      }
      if (!d || d.type !== "WA_EMBEDDED_SIGNUP") return;
      ouviuMeta = true;
      const dados = d.data ?? {};
      if (d.event === "FINISH" && dados.waba_id && dados.phone_number_id) {
        ids = { wabaId: String(dados.waba_id), numeroId: String(dados.phone_number_id), empresaId: dados.business_id ? String(dados.business_id) : null };
        conferir();
        return;
      }
      if (d.event === "CANCEL" || d.event === "ERROR" || "current_step" in dados) fim({ tipo: "fechou" });
    }

    cancelarAnterior = cancelar;
    window.addEventListener("message", ouvir);
    fb.login((r) => {
      const c = r.authResponse?.code;
      if (c) {
        code = c;
        conferir();
        // Os ids vêm logo depois do code; sem eles não há o que ligar.
        if (!acabou) espera = window.setTimeout(() => fim({ tipo: "fechou" }), 15000);
        return;
      }
      // Sem code e sem nenhuma palavra da Meta, em instantes: a janela nem abriu.
      fim(!ouviuMeta && Date.now() - inicio < 1500 ? { tipo: "bloqueada" } : { tipo: "fechou" });
    }, {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "", sessionInfoVersion: "3", version: "v4" },
    });
  });
}

// Proxy (antigo middleware): gera um nonce por requisição e grava a CSP e os cabeçalhos de
// segurança (F0.8). O nonce exige renderização dinâmica das páginas.
import { NextResponse, type NextRequest } from "next/server";
import { cabecalhosSeguranca, gerarNonce, montarCsp, origemArmazenamento, usaJanelaMeta } from "@triade/servidor/cabecalhos";

export function proxy(request: NextRequest) {
  const nonce = gerarNonce();
  // Fotos e documentos vão e vêm direto do armazenamento privado, por links assinados (PT-07).
  const csp = montarCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    armazenamento: origemArmazenamento(process.env.SUPABASE_FUNCTIONS_URL),
    // A janela da Meta (cadastro incorporado do WhatsApp) só na página que a abre.
    janelaMeta: usaJanelaMeta("plataforma", request.nextUrl.pathname),
  });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const resposta = NextResponse.next({ request: { headers } });
  resposta.headers.set("content-security-policy", csp);
  for (const [k, v] of Object.entries(cabecalhosSeguranca("plataforma", request.nextUrl.pathname))) resposta.headers.set(k, v);
  return resposta;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

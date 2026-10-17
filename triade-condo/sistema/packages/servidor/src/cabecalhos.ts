// Cabeçalhos de segurança e CSP com nonce (F0.8), iguais nos dois apps. Nenhum dos dois
// pode ser carregado em frame nem aparecer em busca: são sistemas de quem tem acesso.

export type App = "plataforma" | "console";

export interface OpcoesCsp {
  nonce: string;
  dev?: boolean;
  /**
   * Endereço do Supabase (ex.: https://<projeto>.supabase.co). Só a Plataforma passa: o
   * navegador envia e abre fotos e documentos direto no armazenamento privado, por links
   * assinados que a API gera (PT-07). Fica liberado só o caminho dos objetos.
   */
  armazenamento?: string;
}

/** Origem do armazenamento a partir da URL das funções; vazio se não for uma URL https. */
export function origemArmazenamento(urlFuncoes: string | undefined): string | undefined {
  try {
    const u = new URL(urlFuncoes ?? "");
    return u.protocol === "https:" ? `${u.origin}/storage/v1/object/` : undefined;
  } catch {
    return undefined;
  }
}

export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function montarCsp({ nonce, dev = false, armazenamento }: OpcoesCsp): string {
  const arq = armazenamento ? [armazenamento] : [];
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-inline'"] : [])],
    // Atributos style não executam código; <style> e scripts continuam presos ao nonce.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...arq],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...arq, ...(dev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const partes = Object.entries(diretivas).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) partes.push("upgrade-insecure-requests");
  return partes.join("; ");
}

/** Cabeçalhos fixos (sem a CSP), aplicados em todas as respostas dos dois apps. */
export function cabecalhosSeguranca(_app: App, caminho = "/"): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    // Os links de redefinir senha e de convite levam o token na URL: nada de referrer ali.
    "Referrer-Policy": caminho.startsWith("/redefinir") || caminho.startsWith("/convite") ? "no-referrer" : "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
    // Tudo nos dois sistemas é dado de condomínio ou da equipe: nunca em cache compartilhado.
    "Cache-Control": "private, no-store",
  };
}

// Cabeçalhos de segurança e CSP com nonce (F0.8), iguais nos dois apps. Nenhum dos dois
// pode ser carregado em frame nem aparecer em busca: são sistemas de quem tem acesso.

export type App = "plataforma" | "console";

export interface OpcoesCsp {
  nonce: string;
  dev?: boolean;
  /**
   * Endereço do Supabase (ex.: https://<projeto>.supabase.co). A Plataforma (PT-07) e o Console
   * (os PDFs do contrato, 0308) passam: o navegador envia e abre os arquivos direto no
   * armazenamento privado, por links assinados que a API gera. Fica liberado só o caminho dos objetos.
   */
  armazenamento?: string;
  /** A tela que abre a janela da Meta (cadastro incorporado do WhatsApp, quadro 466). */
  janelaMeta?: boolean;
}

/**
 * A janela da Meta (SDK do Facebook) só na página do WhatsApp nas Configurações da Plataforma:
 * o SDK entra por script com nonce (o strict-dynamic libera o que ele carrega), abre frames do
 * facebook.com e fala com o graph; e a janela aberta precisa responder à página (COOP).
 */
export function usaJanelaMeta(app: App, caminho: string): boolean {
  return app === "plataforma" && caminho === "/configuracoes/whatsapp";
}
const META_FRAMES = ["https://www.facebook.com", "https://web.facebook.com", "https://staticxx.facebook.com"];
const META_CONEXAO = ["https://www.facebook.com", "https://graph.facebook.com", "https://connect.facebook.net"];

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

export function montarCsp({ nonce, dev = false, armazenamento, janelaMeta = false }: OpcoesCsp): string {
  const arq = armazenamento ? [armazenamento] : [];
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-inline'"] : [])],
    // Atributos style não executam código; <style> e scripts continuam presos ao nonce.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...arq, ...(janelaMeta ? ["https://*.facebook.com", "https://*.fbcdn.net"] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...arq, ...(janelaMeta ? META_CONEXAO : []), ...(dev ? ["ws:"] : [])],
    "frame-src": janelaMeta ? META_FRAMES : ["'none'"],
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
export function cabecalhosSeguranca(app: App, caminho = "/"): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    // Os links de redefinir senha, de convite, da proposta do Comercial (/o, no Console) e de
    // agendamento da demonstração (/a, 0310) levam o código na URL: nada de referrer ali.
    "Referrer-Policy": caminho.startsWith("/redefinir") || caminho.startsWith("/convite")
      || (app === "console" && (caminho.startsWith("/o/") || caminho.startsWith("/a/")))
      ? "no-referrer" : "strict-origin-when-cross-origin",
    // A câmera só no link do prestador, para ler a etiqueta do local (MP-08).
    "Permissions-Policy": `camera=${caminho.startsWith("/p/") ? "(self)" : "()"}, microphone=(), geolocation=(), browsing-topics=(), payment=()`,
    // A janela da Meta precisa falar com a página que a abriu (quadro 466).
    "Cross-Origin-Opener-Policy": usaJanelaMeta(app, caminho) ? "same-origin-allow-popups" : "same-origin",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
    // Tudo nos dois sistemas é dado de condomínio ou da equipe: nunca em cache compartilhado.
    "Cache-Control": "private, no-store",
  };
}

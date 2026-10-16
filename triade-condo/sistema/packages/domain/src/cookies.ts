// Cookies de sessão (F0.6). A api de cada sistema grava e lê; o repasse /api de cada app
// só deixa passar estes. Um lugar só, para a lista do repasse nunca ficar para trás.

/** Plataforma do síndico: sessão do Supabase Auth (tokens empacotados). */
export const COOKIES_PLATAFORMA = {
  sessao: "__Host-plataforma",
} as const;

/** Console TRÍADE: sessão da equipe, em aal1 até o código do autenticador. */
export const COOKIES_CONSOLE = {
  sessao: "__Host-console",
} as const;

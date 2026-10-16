// Logs sem senhas, tokens nem dado pessoal desnecessário (PT-13). Tudo o que vai para o
// console das funções e dos apps passa por limparParaLog.

/** Chaves cujo valor nunca aparece em log, em qualquer nível do objeto. */
const CHAVES_SENSIVEIS = [
  "senha", "password", "novasenha", "token", "accesstoken", "access_token", "refreshtoken", "refresh_token",
  "tokenhash", "token_hash", "authorization", "cookie", "set-cookie", "apikey", "segredo", "secret",
  "codigo", "code", "email", "telefone", "phone", "cpf", "nome", "name", "endereco", "address", "ip",
];

const OCULTO = "[oculto]";

function chaveSensivel(chave: string): boolean {
  const k = chave.toLowerCase().replace(/[^a-z_-]/g, "");
  return CHAVES_SENSIVEIS.includes(k) || k.endsWith("token") || k.endsWith("senha") || k.endsWith("secret");
}

/** Trechos que parecem segredo mesmo dentro de um texto livre (mensagem de erro, URL). */
function limparTexto(texto: string): string {
  return texto
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, OCULTO) // JWT
    .replace(/(bearer\s+)[\w.~+/=-]+/gi, `$1${OCULTO}`)
    .replace(/([?&](?:token|token_hash|code|apikey|access_token|refresh_token)=)[^&\s]+/gi, `$1${OCULTO}`)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]");
}

export function limparParaLog(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 8) return "[profundo demais]";
  if (typeof valor === "string") return limparTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => limparParaLog(v, profundidade + 1));
  if (valor instanceof Error) return { nome: valor.name, mensagem: limparTexto(valor.message) };
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) saida[k] = chaveSensivel(k) ? OCULTO : limparParaLog(v, profundidade + 1);
    return saida;
  }
  return valor;
}

/** Uma linha de log em JSON, já limpa. */
export function linhaDeLog(nivel: "info" | "aviso" | "erro", dados: Record<string, unknown>): string {
  return JSON.stringify({ nivel, ...(limparParaLog(dados) as Record<string, unknown>) });
}

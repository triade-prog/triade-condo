// Códigos de erro estáveis da API (PT-17). A tela nunca mostra a mensagem crua da API:
// traduz o código com TEXTOS_ERRO (textos.ts).

export const CODIGOS_ERRO = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  MFA_REQUIRED: 403,
  FORBIDDEN: 403,
  CONDOMINIO_REQUIRED: 403,
  NOT_FOUND: 404,
  /** Duas pessoas editaram o mesmo registro (AT-24): a segunda recebe a versão nova. */
  VERSION_CONFLICT: 409,
  TOKEN_INVALID: 410,
  MFA_INVALID: 422,
  PASSWORD_WEAK: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_UNAVAILABLE: 503,
} as const;

export type CodigoErro = keyof typeof CODIGOS_ERRO;

export function statusHttp(codigo: CodigoErro): number {
  return CODIGOS_ERRO[codigo];
}

export function ehCodigoErro(valor: unknown): valor is CodigoErro {
  return typeof valor === "string" && Object.hasOwn(CODIGOS_ERRO, valor);
}

/** Corpo de erro padrão de todas as rotas: { erro: { codigo, detalhes? } }. */
export interface CorpoErro {
  erro: { codigo: CodigoErro; detalhes?: Record<string, unknown> };
}

export class ErroDominio extends Error {
  readonly codigo: CodigoErro;
  readonly detalhes: Record<string, unknown> | undefined;

  constructor(codigo: CodigoErro, detalhes?: Record<string, unknown>) {
    super(codigo);
    this.name = "ErroDominio";
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  get status(): number {
    return statusHttp(this.codigo);
  }

  toJSON(): CorpoErro {
    return { erro: this.detalhes ? { codigo: this.codigo, detalhes: this.detalhes } : { codigo: this.codigo } };
  }
}

/**
 * Erros que o banco levanta com código próprio (SQLSTATE da classe TC). As Edge Functions
 * traduzem para o código da API; o que não está aqui vira INTERNAL_ERROR.
 */
export const ERROS_BANCO: Record<string, CodigoErro> = {
  TC401: "FORBIDDEN",
  TC404: "NOT_FOUND",
  TC409: "VERSION_CONFLICT",
  TC422: "VALIDATION_ERROR",
};

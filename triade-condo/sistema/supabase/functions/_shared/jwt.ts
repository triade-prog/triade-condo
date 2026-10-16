import { deBase64url } from "./cripto.ts";

/** Lê as claims do JWT. Só usar depois que o Auth validou o token. */
export function claimsJwt(token: string): Record<string, unknown> {
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("JWT inválido");
  return JSON.parse(deBase64url(partes[1]!));
}

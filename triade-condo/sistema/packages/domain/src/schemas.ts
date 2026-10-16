// Contratos de entrada da API (PT-17), validados no servidor. O mesmo esquema serve às telas.

import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).email();

export const entrarSchema = z.object({
  email,
  senha: z.string().min(1).max(200),
});

export const codigoAutenticadorSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/),
  factorId: z.string().uuid().optional(),
});

export const recuperarSenhaSchema = z.object({ email });

export const redefinirSenhaSchema = z.object({
  tokenHash: z.string().min(16).max(200).regex(/^[A-Za-z0-9_-]+$/),
  novaSenha: z.string().min(12).max(200),
});

export const escolherCondominioSchema = z.object({
  condominioId: z.string().uuid(),
});

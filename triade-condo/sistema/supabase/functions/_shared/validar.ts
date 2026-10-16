// Corpo JSON validado pelo esquema do packages/domain (PT-17).

import type { Context } from "hono";
import type { z } from "zod";
import { ErroDominio } from "@triade/domain";

export async function lerCorpo<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  if (!(c.req.header("content-type") ?? "").startsWith("application/json")) throw new ErroDominio("VALIDATION_ERROR");
  const corpo = await c.req.json().catch(() => undefined);
  const r = schema.safeParse(corpo);
  if (r.success) return r.data;
  throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
}

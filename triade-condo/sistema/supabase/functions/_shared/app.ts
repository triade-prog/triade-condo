// Monta o app Hono de uma função com as regras comuns: segredo de repasse, erros no formato
// padrão, nada em cache e log sem dado sensível.

import { Hono, type Env } from "hono";
import { ErroDominio } from "@triade/domain";
import { CABECALHO_SEGREDO, segredoConfere } from "./repasse.ts";
import { ErroBanco, traduzirErroBanco } from "./banco.ts";
import { registrar } from "./registro.ts";

export function respostaErro(e: ErroDominio): Response {
  return new Response(JSON.stringify(e.toJSON()), {
    status: e.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// deno-lint-ignore ban-types
export function criarApp<E extends Env = {}>(nome: string, segredo: string | undefined): Hono<E> {
  const app = new Hono<E>().basePath(`/${nome}`);

  app.use("*", async (c, next) => {
    if (!segredo || !segredoConfere(c.req.header(CABECALHO_SEGREDO) ?? null, segredo)) {
      return respostaErro(new ErroDominio("FORBIDDEN"));
    }
    await next();
    c.header("cache-control", "no-store");
  });

  app.onError((err, c) => {
    if (err instanceof ErroDominio) return respostaErro(err);
    if (err instanceof ErroBanco) {
      const traduzido = traduzirErroBanco(err);
      if (traduzido) return respostaErro(traduzido);
    }
    registrar("erro", { funcao: nome, rota: c.req.routePath, metodo: c.req.method, erro: err });
    return respostaErro(new ErroDominio("INTERNAL_ERROR"));
  });

  app.notFound(() => respostaErro(new ErroDominio("NOT_FOUND")));
  return app;
}

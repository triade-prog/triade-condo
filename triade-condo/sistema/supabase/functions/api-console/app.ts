// API do Console TRÍADE. Só a equipe ativa, sempre com o autenticador (F0.6, PT-08).

import { COOKIES_CONSOLE } from "@triade/domain";
import { criarApp } from "../_shared/app.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";

export function criarApiConsole(segredo: string | undefined, deps: DepsSessao & { urlApp: string }) {
  const app = criarApp<VarsSessao>("api-console", segredo);
  const sessao = criarSessao(
    { sistema: "console", cookie: COOKIES_CONSOLE.sessao, autenticadorObrigatorio: true, funcaoAcesso: "acesso_console", urlApp: deps.urlApp },
    deps,
  );

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-console" }));
  sessao.rotas(app);

  app.use("/v1/sessao", sessao.exigirSessao);
  app.get("/v1/sessao", (c) => c.json({ pessoaId: c.get("sessao").pessoaId }));

  return app;
}

// Erros padronizados (PT-17), tradução dos erros do banco e logs sem dado sensível (PT-13).
import { assert, assertEquals } from "@std/assert";
import { ErroDominio } from "@triade/domain";
import { criarApp } from "./app.ts";
import { erroBanco, pedido } from "./teste_util.ts";

function montar() {
  const app = criarApp("api-teste", "segredo-de-repasse-de-teste");
  app.get("/v1/conflito", () => erroBanco("TC409", { versao: 3, atual: { id: "x", versao: 3, titulo: "novo" } }));
  app.get("/v1/proibido", () => erroBanco("TC401"));
  app.get("/v1/dominio", () => {
    throw new ErroDominio("NOT_FOUND");
  });
  app.get("/v1/quebrou", () => {
    throw new Error("falhou com Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln para ana@exemplo.com.br");
  });
  return pedido(app, "api-teste");
}

Deno.test("AT-24: conflito de versão do banco vira 409 com a versão nova e o registro atual", async () => {
  const r = await montar()("/v1/conflito");
  assertEquals(r.status, 409);
  assertEquals(await r.json(), { erro: { codigo: "VERSION_CONFLICT", detalhes: { versao: 3, atual: { id: "x", versao: 3, titulo: "novo" } } } });
});

Deno.test("sem permissão no banco vira 403, sem revelar o motivo", async () => {
  const r = await montar()("/v1/proibido");
  assertEquals(r.status, 403);
  assertEquals(await r.json(), { erro: { codigo: "FORBIDDEN" } });
});

Deno.test("rota que não existe e erro do domínio no formato padrão", async () => {
  const pedir = montar();
  assertEquals(await (await pedir("/v1/nada")).json(), { erro: { codigo: "NOT_FOUND" } });
  assertEquals((await pedir("/v1/dominio")).status, 404);
});

Deno.test("PT-13: erro inesperado vira 500 e o log sai sem token nem e-mail", async () => {
  const linhas: string[] = [];
  const original = console.error;
  console.error = (l: string) => linhas.push(l);
  try {
    const r = await montar()("/v1/quebrou");
    assertEquals(r.status, 500);
    assertEquals(await r.json(), { erro: { codigo: "INTERNAL_ERROR" } });
  } finally {
    console.error = original;
  }
  assertEquals(linhas.length, 1);
  assert(!/eyJ|ana@exemplo/.test(linhas[0]!), linhas[0]);
});

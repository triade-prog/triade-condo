// Retenção de dados no Console (F0.11; PT-11, PT-03): as rotas pedem a sessão completa, validam o
// modo e a versão e levam a pessoa da sessão. Quem vê e quem liga a exclusão são decididos no banco
// (044_retencao_dados_test.sql).
import { assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_retencao: () => ({ modo: "CONTANDO", mudadoEm: null, mudadoPor: null, versao: 1, podeLigar: true, rodadas: [],
                               arquivos: { naFila: 0, comErro: 0 }, tipos: [], saidas: [] }),
    console_retencao_modo: (a) => (a.p_versao === 1
      ? { modo: a.p_modo, mudadoEm: "2026-10-24T12:00:00Z", mudadoPor: "Carolina", versao: 2 }
      : erroBanco("TC409", { versao: 2 })),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
  });
  return { pedir: pedido(app, "api-console"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("F0.11: a retenção pede a sessão completa, com o autenticador", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/retencao"))).codigo, "UNAUTHORIZED");
  assertEquals((await erro(await m.pedir("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: "APAGANDO", versao: 1 } }))).codigo, "UNAUTHORIZED");
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  assertEquals((await m.pedir("/v1/retencao", { cookie: aal1 })).status, 403);
  assertEquals(m.chamadas.some((c) => c.funcao.startsWith("console_retencao")), false);
});

Deno.test("PT-11: ler a retenção leva só a pessoa da sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/retencao", { cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).modo, "CONTANDO");
  assertEquals(chamada(m, "console_retencao"), { p_pessoa: CAROLINA });
});

Deno.test("PT-11: mudar o modo leva o modo e a versão; versão velha é conflito", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: "APAGANDO", versao: 1 }, cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).versao, 2);
  assertEquals(chamada(m, "console_retencao_modo"), { p_pessoa: CAROLINA, p_modo: "APAGANDO", p_versao: 1 });
  const velha = await m.pedir("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: "CONTANDO", versao: 5 }, cookie });
  assertEquals((await erro(velha)).codigo, "VERSION_CONFLICT");
});

Deno.test("PT-11: modo desconhecido ou sem versão nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const desconhecido = await m.pedir("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: "DESLIGADO", versao: 1 }, cookie });
  assertEquals(desconhecido.status, 400);
  assertEquals((await erro(desconhecido)).detalhes?.campos, ["modo"]);
  const semVersao = await m.pedir("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: "APAGANDO" }, cookie });
  assertEquals((await erro(semVersao)).detalhes?.campos, ["versao"]);
  assertEquals(m.chamadas.some((c) => c.funcao === "console_retencao_modo"), false);
});

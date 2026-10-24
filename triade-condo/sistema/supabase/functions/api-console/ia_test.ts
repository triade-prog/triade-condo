// Cartão IA e custo da ficha do cliente (IA-20, NG-13, NG-15): uso e custo do mês em reais, o
// custo se usar todo o limite, a chave e o limite. Quem pode mudar é o banco que diz.
import { assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar(handlers: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_ia_cliente: () => ({
      ligada: true, versao: 4,
      sugerir: { ligada: true, usadas: 46, limite: 250, chamadas: 46, falhas: 0, custoMicros: 46 * 275, custoMicrosReais: 0 },
      transcrever: { ligada: true, segundos: 1080, minutos: 18, limite: 60, audios: 23, chamadas: 23, falhas: 0, custoMicros: 81_000, custoMicrosReais: 0 },
      renovaEm: "2026-11-01", pode: { chave: true, limite: true },
    }),
    console_ia_chamadas: () => [{ id: "x", funcao: "SUGERIR", resultado: "OK" }],
    console_ia_chave: (a) => ({ versao: Number(a.p_versao) + 1, ligada: a.p_ligada }),
    console_ia_ajustar: (a) => ({ versao: Number(a.p_versao) + 1 }),
    ...handlers,
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
const base = `/v1/clientes/${IPE}/ia`;

Deno.test("NG-15: o cartão IA e custo mostra o custo do mês em reais e quanto custaria todo o limite", async () => {
  const m = montar();
  const r = await (await m.pedir(base, { cookie: await entrar(m) })).json();
  assertEquals(r.reais, { sugerirCentavos: 7, transcreverCentavos: 45, totalCentavos: 52, noLimiteCentavos: 186, tabelaDe: "2026-10-06", dolarCentavos: 550 });
  assertEquals(chamada(m, "console_ia_cliente"), { p_pessoa: CAROLINA, p_condominio: IPE });
});

Deno.test("NG-13: as chamadas do mês vêm do registro de cada chamada", async () => {
  const m = montar();
  assertEquals(await (await m.pedir(`${base}/chamadas`, { cookie: await entrar(m) })).json(), { chamadas: [{ id: "x", funcao: "SUGERIR", resultado: "OK" }] });
});

Deno.test("IA-20: desligar a IA pede motivo antes do banco; ligar não pede", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${base}/chave`, { metodo: "PUT", corpo: { versao: 4, ligada: false }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals(chamada(m, "console_ia_chave"), undefined);
  const r = await m.pedir(`${base}/chave`, { metodo: "PUT", corpo: { versao: 4, ligada: false, motivo: "Contrato em revisão" }, cookie });
  assertEquals(await r.json(), { versao: 5, ligada: false });
  assertEquals(chamada(m, "console_ia_chave"), { p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 4, p_ligada: false, p_motivo: "Contrato em revisão" });
  await m.pedir(`${base}/chave`, { metodo: "PUT", corpo: { versao: 5, ligada: true }, cookie });
  assertEquals(chamada(m, "console_ia_chave")!.p_motivo, null);
});

Deno.test("IA-20: só a Administração muda a chave e o limite (o banco recusa as outras funções)", async () => {
  const m = montar({ console_ia_chave: () => erroBanco("TC401"), console_ia_ajustar: () => erroBanco("TC401") });
  const cookie = await entrar(m);
  assertEquals((await m.pedir(`${base}/chave`, { metodo: "PUT", corpo: { versao: 4, ligada: true }, cookie })).status, 403);
  assertEquals((await m.pedir(`${base}/limites`, { metodo: "PUT", corpo: { versao: 4, limiteSugestoes: 300, limiteMinutos: 60 }, cookie })).status, 403);
});

Deno.test("IA-20: o limite do mês vai ao banco sem mexer no provedor", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${base}/limites`, { metodo: "PUT", corpo: { versao: 4, limiteSugestoes: -1, limiteMinutos: 60 }, cookie }))).codigo, "VALIDATION_ERROR");
  await m.pedir(`${base}/limites`, { metodo: "PUT", corpo: { versao: 4, limiteSugestoes: 300, limiteMinutos: 90 }, cookie });
  assertEquals(chamada(m, "console_ia_ajustar"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 4, p_limite_sugestoes: 300, p_limite_minutos: 90, p_provedor: null, p_modelo: null, p_provedor_transcricao: null,
  });
});

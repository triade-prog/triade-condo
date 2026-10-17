// Passos 6 e 7 na Plataforma do síndico: avisos, regras de aviso, prazo do pedido e
// indicadores. As rotas validam a entrada, mandam ao banco a pessoa e o condomínio da sessão
// e deixam a permissão para o banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const AVISO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_avisos: () => ({ itens: [], naoVistos: 0 }),
    plataforma_marcar_avisos: (a) => (Array.isArray(a.p_ids) ? a.p_ids.length : 3),
    plataforma_definir_avisos: (a) => Number(a.p_versao) + 1,
    plataforma_pedido_prazo: () => ({ vencido: false }),
    plataforma_indicadores: (a) => ({ periodo: a.p_periodo, atual: {}, porcentagemAnterior: null }),
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("F6.1: os avisos só com sessão, da pessoa e do condomínio dela", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/avisos"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir(`/v1/condominio/avisos?pessoa=${OUTRO}`, { cookie })).json(), { itens: [], naoVistos: 0 });
  assertEquals(chamada(m, "plataforma_avisos"), { p_pessoa: ANA, p_condominio: AURORA });
});

Deno.test("F6.1: marcar os escolhidos ou todos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir("/v1/condominio/avisos/vistos", { corpo: { ids: [AVISO] }, cookie })).json(), { marcados: 1 });
  assertEquals(chamada(m, "plataforma_marcar_avisos")?.p_ids, [AVISO]);
  m.chamadas.length = 0;
  assertEquals(await (await m.pedir("/v1/condominio/avisos/vistos", { corpo: {}, cookie })).json(), { marcados: 3 });
  assertEquals(chamada(m, "plataforma_marcar_avisos")?.p_ids, null);
  const r = await m.pedir("/v1/condominio/avisos/vistos", { corpo: { ids: ["nao-e-id"] }, cookie });
  assertEquals(r.status, 400);
});

Deno.test("F6.2: regras de aviso validadas antes do banco, com a versão lida", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const regras = { versao: 4, sindicoHoras: 2, substitutoHoras: 8, substitutoId: OUTRO, semResponsavelHoras: 4, pendenciaDias: 3 };
  assertEquals(await (await m.pedir("/v1/condominio/regras-aviso", { metodo: "PUT", corpo: regras, cookie })).json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_definir_avisos"), {
    p_pessoa: ANA, p_condominio: AURORA, p_versao: 4, p_sindico_horas: 2, p_substituto_horas: 8, p_substituto: OUTRO,
    p_sem_responsavel_horas: 4, p_pendencia_dias: 3,
  });
  m.chamadas.length = 0;
  const r = await m.pedir("/v1/condominio/regras-aviso", { metodo: "PUT", corpo: { ...regras, substitutoHoras: 2 }, cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["substitutoHoras"]);
  assertEquals(chamada(m, "plataforma_definir_avisos"), undefined);
});

Deno.test("AT-09: o prazo do pedido pelo id da rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/prazo`, { cookie })).json(), { vencido: false });
  assertEquals(chamada(m, "plataforma_pedido_prazo")?.p_id, PEDIDO);
  assertEquals((await m.pedir("/v1/condominio/pedidos/x/prazo", { cookie })).status, 404);
});

Deno.test("F7.2: indicadores por período conhecido; sem período, este mês", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/indicadores", { cookie })).json()).periodo, "ESTE_MES");
  assertEquals((await (await m.pedir("/v1/condominio/indicadores?periodo=TRES_MESES", { cookie })).json()).periodo, "TRES_MESES");
  const r = await m.pedir("/v1/condominio/indicadores?periodo=SEMPRE", { cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["periodo"]);
});

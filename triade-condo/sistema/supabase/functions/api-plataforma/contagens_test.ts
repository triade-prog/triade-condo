// O número de cada aba das listas (D4.2, D4.9, D4.11): a rota pede a lista uma vez por situação,
// com os filtros da tela, e devolve só os totais. A permissão continua no banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const AREA = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const POR_SITUACAO: Record<string, number> = { ABERTO: 2, EM_ANDAMENTO: 3, EM_REVISAO: 1, ENCERRADO: 40, CANCELADO: 4 };

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
    plataforma_pedidos: (a) => ({ itens: [], total: POR_SITUACAO[String(a.p_situacao)] ?? 0 }),
    plataforma_manutencoes: (a) => ({ itens: [], total: { PLANEJADA: 1, EM_ANDAMENTO: 2, PENDENTE: 1, CONCLUIDA: 9, CANCELADA: 0 }[String(a.p_situacao)] ?? 0 }),
    plataforma_comunicados: (a) => ({ itens: [], total: { PUBLICADO: 5, PROGRAMADO: 1, RASCUNHO: 2, ARQUIVADO: 7 }[String(a.p_filtro)] ?? 0 }),
    plataforma_decisoes: (a) => ({ decisoes: Array.from({ length: a.p_filtro === "DECIDIDAS" ? 3 : 4 }), aguardandoEu: 1 }),
    plataforma_reservas: (a) => ({ reservas: Array.from({ length: { A_APROVAR: 1, PROXIMAS: 2, TODAS: 6 }[String(a.p_filtro)] ?? 0 }) }),
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

const chamadas = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.filter((c) => c.funcao === funcao).map((c) => c.args);

Deno.test("AT-02: as contagens da fila de pedidos, uma por situação, com os filtros da tela", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/contagens/pedidos"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/contagens/pedidos?responsavel=EU&busca=vaz&situacao=ENCERRADO&pagina=3", { cookie });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ABERTO: 2, EM_ANDAMENTO: 3, EM_REVISAO: 1, ENCERRADO: 40, CANCELADO: 4, ATIVOS: 6, TODOS: 50 });
  const args = chamadas(m, "plataforma_pedidos");
  assertEquals(args.map((a) => a.p_situacao).sort(), ["ABERTO", "CANCELADO", "EM_ANDAMENTO", "EM_REVISAO", "ENCERRADO"]);
  for (const a of args) {
    assertEquals([a.p_condominio, a.p_responsavel, a.p_busca, a.p_pagina], [AURORA, "EU", "vaz", 1]);
  }
  const ruim = await m.pedir("/v1/condominio/contagens/pedidos?atencao=QUALQUER", { cookie });
  assertEquals(ruim.status, 400);
});

Deno.test("MP-01: as contagens das manutenções somam as abertas e todas", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/contagens/manutencao?tipo=PREVENTIVA", { cookie });
  assertEquals(await r.json(), { PLANEJADA: 1, EM_ANDAMENTO: 2, PENDENTE: 1, CONCLUIDA: 9, CANCELADA: 0, ABERTAS: 4, TODAS: 13 });
  assertEquals(new Set(chamadas(m, "plataforma_manutencoes").map((a) => a.p_tipo)), new Set(["PREVENTIVA"]));
});

Deno.test("CD-01: as contagens dos comunicados por aba", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/contagens/comunicados?assunto=OBRAS", { cookie });
  assertEquals(await r.json(), { PUBLICADO: 5, PROGRAMADO: 1, RASCUNHO: 2, ARQUIVADO: 7 });
  assertEquals(new Set(chamadas(m, "plataforma_comunicados").map((a) => a.p_assunto)), new Set(["OBRAS"]));
});

Deno.test("AT-23 e AC-01: decisões e reservas contam pelo tamanho da lista", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir("/v1/condominio/contagens/decisoes", { cookie })).json(), { DECIDIDAS: 3, TODAS: 4 });
  assertEquals(await (await m.pedir(`/v1/condominio/contagens/reservas?areaId=${AREA}`, { cookie })).json(), { A_APROVAR: 1, PROXIMAS: 2, TODAS: 6 });
  assertEquals(new Set(chamadas(m, "plataforma_reservas").map((a) => a.p_area)), new Set([AREA]));
  assertEquals((await m.pedir("/v1/condominio/contagens/outra", { cookie })).status, 404);
});
